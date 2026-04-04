import { registerAppTool } from '@modelcontextprotocol/ext-apps/server';
import type { TextContent } from '@modelcontextprotocol/sdk/types.js';
import {
  approvalInputSchema,
  fetchPageInputSchema,
  proposalLookupInputSchema,
  proposeCreatePageInputSchema,
  proposeUpdatePageInputSchema,
  rollbackInputSchema,
  searchKnowledgeInputSchema,
} from '@cybergogne/schemas';
import { WIDGET_URI } from './resources.js';
import type { AppContext } from './context.js';

type AppToolUiMeta = {
  resourceUri?: string;
  visibility?: Array<'model' | 'app'>;
};

function asText(content: unknown): TextContent[] {
  return [
    {
      type: 'text',
      text: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
    },
  ];
}

function summarizeScope(scope: any) {
  return {
    scope_id: scope.scope_id,
    space_key: scope.confluence_space_key,
    root_page_id: scope.root_page_id,
  };
}

function toPagePayload(page: any, includeBody: boolean, bodyFormat: 'storage' | 'atlas_doc_format') {
  const payload: Record<string, unknown> = {
    page_id: page.id,
    title: page.title,
    status: page.status,
    version: page.versionNumber,
    space_key: page.spaceKey,
    ancestor_ids: page.ancestors,
    labels: page.labels,
    web_url: page.webUrl,
  };

  if (includeBody) {
    payload.body = bodyFormat === 'atlas_doc_format' ? page.bodyAtlasDocFormat : page.bodyStorage;
    payload.body_format = bodyFormat;
  }

  return payload;
}

function getSecuritySchemes(context: AppContext) {
  if (context.env.MCP_AUTH_MODE !== 'bearer') {
    return undefined;
  }

  return [
    {
      type: 'oauth2',
      scopes: context.env.mcpRequiredScopes,
    },
  ];
}

function getServerToolMeta(context: AppContext) {
  const securitySchemes = getSecuritySchemes(context);
  if (!securitySchemes) {
    return undefined;
  }

  return {
    securitySchemes,
  };
}

function getAppToolMeta(context: AppContext, ui: AppToolUiMeta) {
  const securitySchemes = getSecuritySchemes(context);
  return {
    ...(securitySchemes ? { securitySchemes } : {}),
    ui,
  };
}

export function registerTools(server: any, context: AppContext) {
  server.registerTool(
    'search_knowledge',
    {
      title: 'Search knowledge',
      description: 'Search Confluence content within the resolved scope.',
      inputSchema: searchKnowledgeInputSchema.shape,
      annotations: { readOnlyHint: true },
      _meta: getServerToolMeta(context),
    },
    async (input: any) => {
      const scope = await context.resolver.resolve(input);
      context.resolver.assertSearchAllowed(scope);
      const search = await context.confluence.searchContentByCql(scope, input.query, input.limit, input.cursor);
      const payload = {
        scope: summarizeScope(scope),
        results: search.results,
        next_cursor: search.nextCursor,
      };
      await context.audit.log({
        scope_id: scope.scope_id,
        actor_type: 'model',
        action: 'search_knowledge',
        resource_type: 'scope',
        resource_ref: scope.scope_id,
        request_payload_redacted: { query: input.query, limit: input.limit },
      });
      return {
        content: asText(`Found ${search.results.length} result(s).`),
        structuredContent: payload,
      };
    },
  );

  server.registerTool(
    'fetch_page',
    {
      title: 'Fetch page',
      description: 'Fetch a specific Confluence page inside the resolved scope.',
      inputSchema: fetchPageInputSchema.shape,
      annotations: { readOnlyHint: true },
      _meta: getServerToolMeta(context),
    },
    async (input: any) => {
      const scope = await context.resolver.resolve(input);
      const page = await context.confluence.getPage(input.page_id, input.body_format);
      context.resolver.assertPageUnderRoot(scope, {
        id: page.id,
        ancestors: page.ancestors,
      });
      await context.audit.log({
        scope_id: scope.scope_id,
        actor_type: 'model',
        action: 'fetch_page',
        resource_type: 'page',
        resource_ref: page.id,
      });
      return {
        content: asText(page.title),
        structuredContent: toPagePayload(page, input.include_body, input.body_format),
      };
    },
  );

  registerAppTool(
    server,
    'render_search_results_widget',
    {
      title: 'Render search results widget',
      description: 'Render search results in the widget.',
      inputSchema: searchKnowledgeInputSchema.shape,
      annotations: { readOnlyHint: true },
      _meta: getAppToolMeta(context, { resourceUri: WIDGET_URI }),
    },
    async (input: any) => {
      const scope = await context.resolver.resolve(input);
      context.resolver.assertSearchAllowed(scope);
      const search = await context.confluence.searchContentByCql(scope, input.query, input.limit, input.cursor);
      return {
        content: asText(`Rendering ${search.results.length} result(s).`),
        structuredContent: {
          widgetView: 'search',
          scope: summarizeScope(scope),
          results: search.results,
          next_cursor: search.nextCursor,
        },
      };
    },
  );

  server.registerTool(
    'propose_create_page',
    {
      title: 'Propose create page',
      description: 'Create a local proposal without publishing to Confluence.',
      inputSchema: proposeCreatePageInputSchema.shape,
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
      _meta: getServerToolMeta(context),
    },
    async (input: any) => {
      const payload = await context.proposals.proposeCreatePage(input);
      return { content: asText('Proposal created.'), structuredContent: payload };
    },
  );

  server.registerTool(
    'propose_update_page',
    {
      title: 'Propose update page',
      description: 'Prepare a managed-sections update proposal.',
      inputSchema: proposeUpdatePageInputSchema.shape,
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
      _meta: getServerToolMeta(context),
    },
    async (input: any) => {
      const payload = await context.proposals.proposeUpdatePage(input);
      return { content: asText('Update proposal created.'), structuredContent: payload };
    },
  );

  server.registerTool(
    'preview_proposal',
    {
      title: 'Preview proposal',
      description: 'Preview a proposal and its diff.',
      inputSchema: proposalLookupInputSchema.shape,
      annotations: { readOnlyHint: true },
      _meta: getServerToolMeta(context),
    },
    async (input: any) => {
      const payload = await context.proposals.previewProposal(input);
      return { content: asText('Preview ready.'), structuredContent: payload };
    },
  );

  registerAppTool(
    server,
    'render_proposal_widget',
    {
      title: 'Render proposal widget',
      description: 'Render the proposal widget.',
      inputSchema: proposalLookupInputSchema.shape,
      annotations: { readOnlyHint: true },
      _meta: getAppToolMeta(context, { resourceUri: WIDGET_URI }),
    },
    async (input: any) => {
      const payload = await context.proposals.previewProposal(input);
      return { content: asText('Rendering proposal widget.'), structuredContent: payload };
    },
  );

  registerAppTool(
    server,
    'approve_proposal',
    {
      title: 'Approve proposal',
      description: 'Widget-only approval action.',
      inputSchema: approvalInputSchema.shape,
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
      _meta: getAppToolMeta(context, { resourceUri: WIDGET_URI, visibility: ['app'] }),
    },
    async (input: any) => {
      await context.approvals.approveProposal(input);
      const payload = await context.proposals.previewProposal({ proposal_id: input.proposal_id });
      return { content: asText('Proposal approved.'), structuredContent: payload };
    },
  );

  registerAppTool(
    server,
    'reject_proposal',
    {
      title: 'Reject proposal',
      description: 'Widget-only rejection action.',
      inputSchema: approvalInputSchema.shape,
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
      _meta: getAppToolMeta(context, { resourceUri: WIDGET_URI, visibility: ['app'] }),
    },
    async (input: any) => {
      await context.approvals.rejectProposal(input);
      const payload = await context.proposals.previewProposal({ proposal_id: input.proposal_id });
      return { content: asText('Proposal rejected.'), structuredContent: payload };
    },
  );

  registerAppTool(
    server,
    'publish_approved_proposal',
    {
      title: 'Publish approved proposal',
      description: 'Widget-only publication action.',
      inputSchema: approvalInputSchema.shape,
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
      _meta: getAppToolMeta(context, { resourceUri: WIDGET_URI, visibility: ['app'] }),
    },
    async (input: any) => {
      const publication = await context.publishing.publishApprovedProposal(input);
      const proposal = await context.proposals.previewProposal({ proposal_id: input.proposal_id });
      return {
        content: asText('Proposal published.'),
        structuredContent: {
          ...proposal,
          publication: publication.publication,
          page_id: publication.pageId,
          version_number: publication.versionNumber,
        },
      };
    },
  );

  registerAppTool(
    server,
    'rollback_publication',
    {
      title: 'Rollback publication',
      description: 'Widget-only rollback action.',
      inputSchema: rollbackInputSchema.shape,
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: true },
      _meta: getAppToolMeta(context, { resourceUri: WIDGET_URI, visibility: ['app'] }),
    },
    async (input: any) => {
      const result = await context.publishing.rollbackPublication(input);
      const proposal = await context.proposals.previewProposal({
        proposal_id: result.publication.proposal_id,
      });
      return {
        content: asText('Rollback executed.'),
        structuredContent: {
          ...proposal,
          publication: result.publication,
        },
      };
    },
  );
}
