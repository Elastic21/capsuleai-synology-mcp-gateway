import path from 'node:path';
import { loadEnv, parseArgs, requiredArg } from '@cybergogne/common';
import { createSqlClient, RegistryRepository } from '@cybergogne/registry';
import { loadResolvedYaml } from './_registry-utils.js';

const args = parseArgs(process.argv.slice(2));
const source = path.resolve(process.cwd(), requiredArg(args, 'source'));
const env = loadEnv();
const sql = createSqlClient(env.DATABASE_URL);
const registry = new RegistryRepository(sql);

try {
  const resolved = await loadResolvedYaml(source);

  for (const item of resolved.scopes) {
    if (item.status !== 'resolved') continue;

    const scope = await registry.findScopeById(item.scope_id, env.CG_ENVIRONMENT);
    if (!scope) continue;

    await registry.upsertScope({
      ...scope,
      confluence_space_key: item.resolved_space_key ?? scope.confluence_space_key,
      confluence_space_id: item.resolved_space_id ?? scope.confluence_space_id ?? null,
      root_page_id: item.resolved_root_page_id ?? scope.root_page_id,
      default_parent_page_id: item.resolved_default_parent_page_id ?? scope.default_parent_page_id,
      ai_inbox_page_id: item.resolved_ai_inbox_page_id ?? scope.ai_inbox_page_id,
      read_cql_guard: `space = "${item.resolved_space_key ?? scope.confluence_space_key}" AND ancestor = ${item.resolved_root_page_id ?? scope.root_page_id}`,
      allowed_doc_types: scope.allowed_doc_types ?? [],
      allowed_template_ids: scope.allowed_template_ids ?? [],
      required_labels: scope.required_labels ?? [],
      forbidden_labels: scope.forbidden_labels ?? [],
    });

    await registry.insertScopeResolution({
      scope_id: scope.scope_id,
      resolved_space_key: item.resolved_space_key ?? scope.confluence_space_key,
      resolved_space_id: item.resolved_space_id ?? null,
      resolved_root_page_id: item.resolved_root_page_id ?? scope.root_page_id,
      resolved_default_parent_page_id: item.resolved_default_parent_page_id ?? scope.default_parent_page_id,
      resolved_ai_inbox_page_id: item.resolved_ai_inbox_page_id ?? scope.ai_inbox_page_id,
      resolved_approver_principal_ref: item.resolved_approver_principal_ref ?? null,
      resolution_source: item,
      resolved_by: 'bootstrap-apply',
    });

    if (item.resolved_approver_principal_ref) {
      const approverGroup = await registry.findApproverGroup(scope.approver_group_key);
      if (approverGroup) {
        await registry.upsertApproverGroup({
          ...approverGroup,
          principal_ref: item.resolved_approver_principal_ref,
        });
      }
    }
  }

  console.log(`Applied resolved registry from ${source}`);
} finally {
  await sql.end({ timeout: 5 });
}
