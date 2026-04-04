import { AppError, newId } from '@cybergogne/common';
import type { ApproverGroupRecord, PublicationPolicyRecord, ScopeRegistryRecord } from '@cybergogne/schemas';
import type { SqlClient } from './db.js';

const json = (value: unknown) => JSON.stringify(value ?? null);

function onlyOne<T>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  return rows[0];
}

function onlyOneScope(rows: any[], matchField: string, matchValue: string) {
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    throw new AppError(
      'SCOPE_AMBIGUOUS',
      `Multiple scopes matched ${matchField}=${matchValue}; resolution is deny-by-default`,
      409,
      { matchField, matchValue, scope_ids: rows.map((row) => row.scope_id) },
    );
  }
  return rows[0];
}

export class RegistryRepository {
  constructor(private readonly sql: SqlClient) {}

  async listScopes(environment?: string) {
    if (environment) {
      return this.sql<any[]>`select * from cg_scope_registry where environment = ${environment} order by scope_id`;
    }
    return this.sql<any[]>`select * from cg_scope_registry order by scope_id`;
  }

  async findScopeById(scopeId: string, environment?: string) {
    if (environment) {
      return onlyOne(await this.sql<any[]>`
        select * from cg_scope_registry where scope_id = ${scopeId} and environment = ${environment}
      `);
    }
    return onlyOne(await this.sql<any[]>`select * from cg_scope_registry where scope_id = ${scopeId}`);
  }

  async findScopeByProjectSlug(projectSlug: string, environment: string) {
    return onlyOneScope(await this.sql<any[]>`
      select * from cg_scope_registry
      where chatgpt_project_slug = ${projectSlug} and environment = ${environment}
      limit 2
    `, 'chatgpt_project_slug', projectSlug);
  }

  async findScopeByKnowledgeAppSlug(slug: string, environment: string) {
    return onlyOneScope(await this.sql<any[]>`
      select * from cg_scope_registry
      where knowledge_app_slug = ${slug} and environment = ${environment}
      limit 2
    `, 'knowledge_app_slug', slug);
  }

  async findScopeByPublisherAppSlug(slug: string, environment: string) {
    return onlyOneScope(await this.sql<any[]>`
      select * from cg_scope_registry
      where publisher_app_slug = ${slug} and environment = ${environment}
      limit 2
    `, 'publisher_app_slug', slug);
  }

  async findPublicationPolicy(key: string) {
    return onlyOne(await this.sql<any[]>`
      select * from cg_publication_policy where publication_policy_key = ${key}
    `);
  }

  async findApproverGroup(key: string) {
    return onlyOne(await this.sql<any[]>`
      select * from cg_approver_group where approver_group_key = ${key}
    `);
  }

  async upsertApproverGroup(record: ApproverGroupRecord) {
    const rows = await this.sql<any[]>`
      insert into cg_approver_group (
        approver_group_key, principal_type, principal_ref, display_name,
        quorum_rule, quorum_value, escalation_group_key, active, notes
      ) values (
        ${record.approver_group_key}, ${record.principal_type}, ${record.principal_ref}, ${record.display_name},
        ${record.quorum_rule}, ${record.quorum_value ?? null}, ${record.escalation_group_key ?? null}, ${record.active}, ${record.notes ?? null}
      )
      on conflict (approver_group_key) do update set
        principal_type = excluded.principal_type,
        principal_ref = excluded.principal_ref,
        display_name = excluded.display_name,
        quorum_rule = excluded.quorum_rule,
        quorum_value = excluded.quorum_value,
        escalation_group_key = excluded.escalation_group_key,
        active = excluded.active,
        notes = excluded.notes,
        updated_at = now()
      returning *
    `;
    return rows[0];
  }

  async upsertPublicationPolicy(record: PublicationPolicyRecord) {
    const rows = await this.sql<any[]>`
      insert into cg_publication_policy (
        publication_policy_key, description, approval_required, create_mode, update_mode,
        publish_after_approval, max_pages_per_operation, diff_required, rollback_allowed,
        default_publish_parent_strategy, default_labels, default_content_properties, notes
      ) values (
        ${record.publication_policy_key}, ${record.description}, ${record.approval_required}, ${record.create_mode}, ${record.update_mode},
        ${record.publish_after_approval}, ${record.max_pages_per_operation}, ${record.diff_required}, ${record.rollback_allowed},
        ${record.default_publish_parent_strategy}, ${json(record.default_labels)}::jsonb, ${json(record.default_content_properties)}::jsonb, ${record.notes ?? null}
      )
      on conflict (publication_policy_key) do update set
        description = excluded.description,
        approval_required = excluded.approval_required,
        create_mode = excluded.create_mode,
        update_mode = excluded.update_mode,
        publish_after_approval = excluded.publish_after_approval,
        max_pages_per_operation = excluded.max_pages_per_operation,
        diff_required = excluded.diff_required,
        rollback_allowed = excluded.rollback_allowed,
        default_publish_parent_strategy = excluded.default_publish_parent_strategy,
        default_labels = excluded.default_labels,
        default_content_properties = excluded.default_content_properties,
        notes = excluded.notes,
        updated_at = now()
      returning *
    `;
    return rows[0];
  }

  async upsertScope(record: ScopeRegistryRecord) {
    const rows = await this.sql<any[]>`
      insert into cg_scope_registry (
        scope_id, enabled, environment, tenant_id, scope_kind,
        chatgpt_project_slug, knowledge_app_slug, publisher_app_slug,
        atlassian_site, confluence_space_key, confluence_space_id,
        root_page_id, default_parent_page_id, ai_inbox_page_id,
        approver_group_key, publication_policy_key, identity_mode, write_target_mode,
        read_cql_guard, allowed_doc_types, allowed_template_ids, required_labels, forbidden_labels,
        owner_ref, notes
      ) values (
        ${record.scope_id}, ${record.enabled}, ${record.environment}, ${record.tenant_id}, ${record.scope_kind},
        ${record.chatgpt_project_slug}, ${record.knowledge_app_slug}, ${record.publisher_app_slug},
        ${record.atlassian_site}, ${record.confluence_space_key}, ${record.confluence_space_id ?? null},
        ${record.root_page_id}, ${record.default_parent_page_id}, ${record.ai_inbox_page_id},
        ${record.approver_group_key}, ${record.publication_policy_key}, ${record.identity_mode}, ${record.write_target_mode},
        ${record.read_cql_guard}, ${json(record.allowed_doc_types)}::jsonb, ${json(record.allowed_template_ids)}::jsonb,
        ${json(record.required_labels)}::jsonb, ${json(record.forbidden_labels)}::jsonb, ${record.owner_ref ?? null}, ${record.notes ?? null}
      )
      on conflict (scope_id) do update set
        enabled = excluded.enabled,
        environment = excluded.environment,
        tenant_id = excluded.tenant_id,
        scope_kind = excluded.scope_kind,
        chatgpt_project_slug = excluded.chatgpt_project_slug,
        knowledge_app_slug = excluded.knowledge_app_slug,
        publisher_app_slug = excluded.publisher_app_slug,
        atlassian_site = excluded.atlassian_site,
        confluence_space_key = excluded.confluence_space_key,
        confluence_space_id = excluded.confluence_space_id,
        root_page_id = excluded.root_page_id,
        default_parent_page_id = excluded.default_parent_page_id,
        ai_inbox_page_id = excluded.ai_inbox_page_id,
        approver_group_key = excluded.approver_group_key,
        publication_policy_key = excluded.publication_policy_key,
        identity_mode = excluded.identity_mode,
        write_target_mode = excluded.write_target_mode,
        read_cql_guard = excluded.read_cql_guard,
        allowed_doc_types = excluded.allowed_doc_types,
        allowed_template_ids = excluded.allowed_template_ids,
        required_labels = excluded.required_labels,
        forbidden_labels = excluded.forbidden_labels,
        owner_ref = excluded.owner_ref,
        notes = excluded.notes,
        updated_at = now()
      returning *
    `;
    return rows[0];
  }

  async insertScopeResolution(input: {
    scope_id: string;
    resolved_space_key: string;
    resolved_space_id?: string | null;
    resolved_root_page_id: string;
    resolved_default_parent_page_id: string;
    resolved_ai_inbox_page_id: string;
    resolved_approver_principal_ref?: string | null;
    resolution_source: Record<string, unknown>;
    resolved_by: string;
  }) {
    await this.sql`update cg_scope_resolution set is_current = false where scope_id = ${input.scope_id} and is_current = true`;
    const rows = await this.sql<any[]>`
      insert into cg_scope_resolution (
        resolution_id, scope_id, resolved_space_key, resolved_space_id,
        resolved_root_page_id, resolved_default_parent_page_id, resolved_ai_inbox_page_id,
        resolved_approver_principal_ref, resolution_source, resolved_by, is_current
      ) values (
        ${newId()}, ${input.scope_id}, ${input.resolved_space_key}, ${input.resolved_space_id ?? null},
        ${input.resolved_root_page_id}, ${input.resolved_default_parent_page_id}, ${input.resolved_ai_inbox_page_id},
        ${input.resolved_approver_principal_ref ?? null}, ${json(input.resolution_source)}::jsonb, ${input.resolved_by}, true
      )
      returning *
    `;
    return rows[0];
  }

  async getCurrentScopeResolution(scopeId: string) {
    return onlyOne(await this.sql<any[]>`
      select * from cg_scope_resolution where scope_id = ${scopeId} and is_current = true
    `);
  }

  async createProposal(input: {
    scope_id: string;
    proposal_type: 'create_page' | 'update_page';
    doc_type: string;
    template_id?: string | null;
    target_page_id?: string | null;
    target_parent_page_id?: string | null;
    title: string;
    body_input: Record<string, unknown>;
    body_rendered: Record<string, unknown>;
    labels: string[];
    content_properties: Record<string, unknown>;
    write_mode: 'append_only' | 'managed_sections';
    status: string;
    created_by: string;
  }) {
    const rows = await this.sql<any[]>`
      insert into cg_proposal (
        proposal_id, scope_id, proposal_type, doc_type, template_id, target_page_id,
        target_parent_page_id, title, body_input, body_rendered, labels, content_properties,
        write_mode, status, created_by
      ) values (
        ${newId()}, ${input.scope_id}, ${input.proposal_type}, ${input.doc_type}, ${input.template_id ?? null}, ${input.target_page_id ?? null},
        ${input.target_parent_page_id ?? null}, ${input.title}, ${json(input.body_input)}::jsonb, ${json(input.body_rendered)}::jsonb,
        ${json(input.labels)}::jsonb, ${json(input.content_properties)}::jsonb, ${input.write_mode}, ${input.status}, ${input.created_by}
      )
      returning *
    `;
    return rows[0];
  }

  async getProposalById(proposalId: string) {
    return onlyOne(await this.sql<any[]>`select * from cg_proposal where proposal_id = ${proposalId}`);
  }

  async updateProposalStatus(proposalId: string, status: string) {
    const rows = await this.sql<any[]>`
      update cg_proposal set status = ${status}, updated_at = now()
      where proposal_id = ${proposalId}
      returning *
    `;
    return rows[0];
  }

  async saveProposalDiff(input: {
    proposal_id: string;
    base_snapshot_id?: string | null;
    before_body?: Record<string, unknown> | null;
    after_body: Record<string, unknown>;
    diff_summary: Record<string, unknown>;
    diff_text: string;
    risk_flags: string[];
  }) {
    const rows = await this.sql<any[]>`
      insert into cg_proposal_diff (
        proposal_id, base_snapshot_id, before_body, after_body, diff_summary, diff_text, risk_flags
      ) values (
        ${input.proposal_id}, ${input.base_snapshot_id ?? null}, ${json(input.before_body ?? null)}::jsonb,
        ${json(input.after_body)}::jsonb, ${json(input.diff_summary)}::jsonb, ${input.diff_text}, ${json(input.risk_flags)}::jsonb
      )
      on conflict (proposal_id) do update set
        base_snapshot_id = excluded.base_snapshot_id,
        before_body = excluded.before_body,
        after_body = excluded.after_body,
        diff_summary = excluded.diff_summary,
        diff_text = excluded.diff_text,
        risk_flags = excluded.risk_flags,
        generated_at = now()
      returning *
    `;
    return rows[0];
  }

  async getProposalDiff(proposalId: string) {
    return onlyOne(await this.sql<any[]>`select * from cg_proposal_diff where proposal_id = ${proposalId}`);
  }

  async saveSnapshot(input: {
    scope_id: string;
    page_id: string;
    version_number: number;
    title: string;
    body_storage?: Record<string, unknown> | null;
    body_atlas_doc_format?: Record<string, unknown> | null;
    labels: string[];
    content_properties: Record<string, unknown>;
  }) {
    const rows = await this.sql<any[]>`
      insert into cg_page_snapshot (
        snapshot_id, scope_id, page_id, version_number, title, body_storage,
        body_atlas_doc_format, labels, content_properties
      ) values (
        ${newId()}, ${input.scope_id}, ${input.page_id}, ${input.version_number}, ${input.title},
        ${json(input.body_storage ?? null)}::jsonb, ${json(input.body_atlas_doc_format ?? null)}::jsonb,
        ${json(input.labels)}::jsonb, ${json(input.content_properties)}::jsonb
      )
      returning *
    `;
    return rows[0];
  }

  async getSnapshot(snapshotId: string) {
    return onlyOne(await this.sql<any[]>`select * from cg_page_snapshot where snapshot_id = ${snapshotId}`);
  }

  async addApproval(input: {
    proposal_id: string;
    approver_group_key: string;
    actor_ref: string;
    decision: 'approved' | 'rejected';
    comment?: string;
  }) {
    const rows = await this.sql<any[]>`
      insert into cg_approval (
        approval_id, proposal_id, approver_group_key, actor_ref, decision, comment
      ) values (
        ${newId()}, ${input.proposal_id}, ${input.approver_group_key}, ${input.actor_ref}, ${input.decision}, ${input.comment ?? null}
      )
      returning *
    `;
    return rows[0];
  }

  async listApprovals(proposalId: string) {
    return this.sql<any[]>`
      select * from cg_approval where proposal_id = ${proposalId} order by decided_at asc
    `;
  }

  async addPublication(input: {
    proposal_id: string;
    scope_id: string;
    action: 'create' | 'update_managed_sections' | 'create_draft' | 'restore_version';
    page_id: string;
    version_number?: number | null;
    confluence_response: Record<string, unknown>;
    published_by: string;
    rollback_of_publication_id?: string | null;
  }) {
    const rows = await this.sql<any[]>`
      insert into cg_publication (
        publication_id, proposal_id, scope_id, action, page_id, version_number,
        confluence_response, published_by, rollback_of_publication_id
      ) values (
        ${newId()}, ${input.proposal_id}, ${input.scope_id}, ${input.action}, ${input.page_id}, ${input.version_number ?? null},
        ${json(input.confluence_response)}::jsonb, ${input.published_by}, ${input.rollback_of_publication_id ?? null}
      )
      returning *
    `;
    return rows[0];
  }

  async getPublication(publicationId: string) {
    return onlyOne(await this.sql<any[]>`select * from cg_publication where publication_id = ${publicationId}`);
  }

  async getLatestPublicationByProposal(proposalId: string) {
    return onlyOne(await this.sql<any[]>`
      select *
      from cg_publication
      where proposal_id = ${proposalId}
      order by published_at desc, publication_id desc
      limit 1
    `);
  }

  async addAuditLog(input: {
    scope_id?: string | null;
    proposal_id?: string | null;
    actor_type: 'model' | 'widget' | 'user' | 'system' | 'script';
    actor_ref?: string | null;
    action: string;
    resource_type: string;
    resource_ref: string;
    request_payload_redacted?: Record<string, unknown>;
    result_payload_redacted?: Record<string, unknown>;
    trace_id?: string | null;
  }) {
    const rows = await this.sql<any[]>`
      insert into cg_audit_log (
        audit_id, scope_id, proposal_id, actor_type, actor_ref, action, resource_type,
        resource_ref, request_payload_redacted, result_payload_redacted, trace_id
      ) values (
        ${newId()}, ${input.scope_id ?? null}, ${input.proposal_id ?? null}, ${input.actor_type}, ${input.actor_ref ?? null},
        ${input.action}, ${input.resource_type}, ${input.resource_ref},
        ${json(input.request_payload_redacted ?? {})}::jsonb, ${json(input.result_payload_redacted ?? {})}::jsonb, ${input.trace_id ?? null}
      )
      returning *
    `;
    return rows[0];
  }
}
