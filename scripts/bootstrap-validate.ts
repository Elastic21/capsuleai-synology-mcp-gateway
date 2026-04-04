import { loadEnv, parseArgs, requiredArg } from '@cybergogne/common';
import { createSqlClient, RegistryRepository } from '@cybergogne/registry';

const args = parseArgs(process.argv.slice(2));
const scopeId = requiredArg(args, 'scope');
const env = loadEnv();
const sql = createSqlClient(env.DATABASE_URL);
const registry = new RegistryRepository(sql);

try {
  const scope = await registry.findScopeById(scopeId, env.CG_ENVIRONMENT);
  if (!scope) {
    throw new Error(`Scope ${scopeId} not found`);
  }

  const expectedGuard = `space = "${scope.confluence_space_key}" AND ancestor = ${scope.root_page_id}`;
  const issues: string[] = [];
  if (scope.read_cql_guard !== expectedGuard) {
    issues.push(`read_cql_guard mismatch: expected "${expectedGuard}" got "${scope.read_cql_guard}"`);
  }

  if (issues.length === 0) {
    console.log(`Scope ${scopeId} is consistent.`);
  } else {
    console.error(`Scope ${scopeId} validation failed:`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  }
} finally {
  await sql.end({ timeout: 5 });
}
