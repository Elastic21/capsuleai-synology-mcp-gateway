import { AppError, markdownToStorageHtml, normalizeContentProperties } from '@cybergogne/common';
import type { AuditService } from '@cybergogne/audit';
import type { ConfluenceClient } from '@cybergogne/confluence';
import { buildStorageDiff, replaceManagedSection } from '@cybergogne/diff-engine';
import type { RegistryRepository } from '@cybergogne/registry';
import type { ScopeResolver } from '@cybergogne/scope-resolver';

export class ProposalService {
  constructor(
    private readonly registry: RegistryRepository,
    private readonly resolver: ScopeResolver,
    private readonly confluence: ConfluenceClient,
    private readonly audit: AuditService,
  ) {}

  async proposeCreatePage(input: any) {
    const scope = await this.resolver.resolve(input);
    await this.resolver.assertWriteAuthorized(scope);
    this.resolver.assertDocTypeAllowed(scope, input.doc_type);
    this.resolver.assertTemplateAllowed(scope, input.template_id);
    this.resolver.assertWriteMode(scope, 'append_only');

    const labels = this.resolver.normalizeLabels(scope, input.labels ?? []);
    const bodyStorage = markdownToStorageHtml(input.content_markdown);
    const contentProperties = normalizeContentProperties(input.content_properties ?? {});

    const proposal = await this.registry.createProposal({
      scope_id: scope.scope_id,
      proposal_type: 'create_page',
      doc_type: input.doc_type,
      template_id: input.template_id ?? null,
      target_parent_page_id: input.target_parent_page_id ?? scope.default_parent_page_id,
      title: input.title,
      body_input: { markdown: input.content_markdown },
      body_rendered: { storage: bodyStorage },
      labels,
      content_properties: contentProperties,
      write_mode: 'append_only',
      status: 'draft',
      created_by: 'model',
    });

    const diff = buildStorageDiff(null, bodyStorage);
    await this.registry.saveProposalDiff({
      proposal_id: proposal.proposal_id,
      after_body: { storage: bodyStorage },
      diff_summary: diff.summary,
      diff_text: diff.diffText,
      risk_flags: diff.riskFlags,
    });

    await this.audit.log({
      scope_id: scope.scope_id,
      proposal_id: proposal.proposal_id,
      actor_type: 'model',
      action: 'propose_create_page',
      resource_type: 'proposal',
      resource_ref: proposal.proposal_id,
      request_payload_redacted: {
        doc_type: input.doc_type,
        title: input.title,
        labels,
      },
    });

    return this.previewProposal({ proposal_id: proposal.proposal_id, scope_id: scope.scope_id });
  }

  async proposeUpdatePage(input: any) {
    const scope = await this.resolver.resolve(input);
    await this.resolver.assertWriteAuthorized(scope);
    this.resolver.assertWriteMode(scope, 'managed_sections');

    const page = await this.confluence.getPage(input.target_page_id, 'storage');
    this.resolver.assertPageUnderRoot(scope, {
      id: page.id,
      ancestors: page.ancestors,
    });

    if (!page.bodyStorage) {
      throw new AppError('PAGE_BODY_MISSING', `Page ${page.id} has no storage body`);
    }

    const replacement = markdownToStorageHtml(input.content_markdown);
    const newBody = replaceManagedSection(page.bodyStorage, input.managed_section_key, replacement);
    const labels = this.resolver.normalizeLabels(scope, input.labels ?? []);

    const snapshot = await this.registry.saveSnapshot({
      scope_id: scope.scope_id,
      page_id: page.id,
      version_number: page.versionNumber,
      title: page.title,
      body_storage: { storage: page.bodyStorage },
      body_atlas_doc_format: page.bodyAtlasDocFormat ?? null,
      labels: page.labels,
      content_properties: {},
    });

    const proposal = await this.registry.createProposal({
      scope_id: scope.scope_id,
      proposal_type: 'update_page',
      doc_type: 'managed_sections',
      target_page_id: page.id,
      title: page.title,
      body_input: {
        target_page_id: page.id,
        managed_section_key: input.managed_section_key,
        markdown: input.content_markdown,
      },
      body_rendered: { storage: newBody },
      labels,
      content_properties: normalizeContentProperties(input.content_properties ?? {}),
      write_mode: 'managed_sections',
      status: 'draft',
      created_by: 'model',
    });

    const diff = buildStorageDiff(page.bodyStorage, newBody);
    await this.registry.saveProposalDiff({
      proposal_id: proposal.proposal_id,
      base_snapshot_id: snapshot.snapshot_id,
      before_body: { storage: page.bodyStorage },
      after_body: { storage: newBody },
      diff_summary: diff.summary,
      diff_text: diff.diffText,
      risk_flags: diff.riskFlags,
    });

    await this.audit.log({
      scope_id: scope.scope_id,
      proposal_id: proposal.proposal_id,
      actor_type: 'model',
      action: 'propose_update_page',
      resource_type: 'proposal',
      resource_ref: proposal.proposal_id,
      request_payload_redacted: {
        target_page_id: page.id,
        managed_section_key: input.managed_section_key,
      },
    });

    return this.previewProposal({ proposal_id: proposal.proposal_id, scope_id: scope.scope_id });
  }

  async previewProposal(input: { proposal_id: string; scope_id?: string }) {
    const proposal = await this.registry.getProposalById(input.proposal_id);
    if (!proposal) {
      throw new AppError('PROPOSAL_NOT_FOUND', `Proposal ${input.proposal_id} not found`, 404);
    }
    const diff = await this.registry.getProposalDiff(proposal.proposal_id);
    const scope = await this.registry.findScopeById(proposal.scope_id);
    const approvals = await this.registry.listApprovals(proposal.proposal_id);
    const publicationPolicy = scope?.publication_policy_key
      ? await this.registry.findPublicationPolicy(scope.publication_policy_key)
      : null;
    const latestPublication = await this.registry.getLatestPublicationByProposal(proposal.proposal_id);

    return {
      widgetView: 'proposal',
      proposal,
      diff,
      scope,
      approvals,
      publication_policy: publicationPolicy,
      latest_publication: latestPublication,
    };
  }
}
