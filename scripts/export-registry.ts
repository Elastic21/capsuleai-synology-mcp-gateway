import path from 'node:path';
import { loadEnv } from '@cybergogne/common';
import { createSqlClient, RegistryRepository } from '@cybergogne/registry';
import { writeYaml } from './_registry-utils.js';

const env = loadEnv();
const sql = createSqlClient(env.DATABASE_URL);
const registry = new RegistryRepository(sql);
const target = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(process.cwd(), 'out/exported-scopes.yaml');

try {
  const scopes = await registry.listScopes(env.CG_ENVIRONMENT);
  await writeYaml(target, {
    schema_version: 'v1',
    generated_at: new Date().toISOString(),
    scopes,
  });
  console.log(`Exported registry to ${target}`);
} finally {
  await sql.end({ timeout: 5 });
}
