import path from 'node:path';
import { parseArgs, requiredArg } from '@cybergogne/common';
import { loadResolvedYaml } from './_registry-utils.js';

const args = parseArgs(process.argv.slice(2));
const source = path.resolve(process.cwd(), requiredArg(args, 'source'));
const resolved = await loadResolvedYaml(source);

for (const item of resolved.scopes) {
  console.log(`- ${item.scope_id}: ${item.status}`);
  if (item.resolved_space_key) console.log(`  space_key: ${item.resolved_space_key}`);
  if (item.resolved_root_page_id) console.log(`  root_page_id: ${item.resolved_root_page_id}`);
  if (item.resolved_default_parent_page_id) console.log(`  default_parent_page_id: ${item.resolved_default_parent_page_id}`);
  if (item.resolved_ai_inbox_page_id) console.log(`  ai_inbox_page_id: ${item.resolved_ai_inbox_page_id}`);
  if (item.resolved_approver_principal_ref) console.log(`  approver: ${item.resolved_approver_principal_ref}`);
  if (item.notes.length > 0) {
    for (const note of item.notes) console.log(`  note: ${note}`);
  }
}
