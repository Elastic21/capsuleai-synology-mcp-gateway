import { readFile, writeFile } from 'node:fs/promises';
import YAML from 'yaml';

function splitCsv(value = '') {
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function loadSeedYaml(filePath) {
  const raw = await readFile(filePath, 'utf8');
  return YAML.parse(raw);
}

export function hydratePublicationPolicy(record) {
  return {
    publication_policy_key: record.publication_policy_key,
    description: record.description,
    approval_required: record.approval_required,
    create_mode: record.create_mode,
    update_mode: record.update_mode,
    publish_after_approval: record.publish_after_approval,
    max_pages_per_operation: record.max_pages_per_operation,
    diff_required: record.diff_required,
    rollback_allowed: record.rollback_allowed,
    default_publish_parent_strategy: record.default_publish_parent_strategy,
    default_labels: splitCsv(record.default_labels_csv),
    default_content_properties: JSON.parse(record.default_content_properties_json || '{}'),
    notes: record.notes ?? null,
  };
}

export function hydrateScope(record) {
  return {
    scope_id: record.scope_id,
    enabled: record.enabled ?? true,
    environment: record.environment,
    tenant_id: record.tenant_id,
    scope_kind: record.scope_kind,
    chatgpt_project_slug: record.chatgpt_project_slug,
    knowledge_app_slug: record.knowledge_app_slug,
    publisher_app_slug: record.publisher_app_slug,
    atlassian_site: record.atlassian_site,
    confluence_space_key: record.confluence_space_key,
    confluence_space_id: record.confluence_space_id || null,
    root_page_id: record.root_page_id,
    default_parent_page_id: record.default_parent_page_id,
    ai_inbox_page_id: record.ai_inbox_page_id,
    approver_group_key: record.approver_group_key,
    publication_policy_key: record.publication_policy_key,
    identity_mode: record.identity_mode,
    write_target_mode: record.write_target_mode,
    read_cql_guard: record.read_cql_guard,
    allowed_doc_types: splitCsv(record.allowed_doc_types_csv),
    allowed_template_ids: splitCsv(record.allowed_template_ids_csv),
    required_labels: splitCsv(record.required_labels_csv),
    forbidden_labels: splitCsv(record.forbidden_labels_csv),
    owner_ref: record.owner_ref || null,
    notes: record.notes || null,
  };
}

export async function writeYaml(filePath, value) {
  await writeFile(filePath, YAML.stringify(value), 'utf8');
}
