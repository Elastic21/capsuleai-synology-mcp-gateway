import path from 'node:path';
import { loadEnv } from '../packages/common/dist/index.js';
import { createSqlClient, RegistryRepository } from '../packages/registry/dist/index.js';
import { hydratePublicationPolicy, hydrateScope, loadSeedYaml } from './_registry-utils-prod.mjs';

const env = loadEnv();
const sql = createSqlClient(env.DATABASE_URL);
const registry = new RegistryRepository(sql);

const source = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(process.cwd(), 'cg_scope_registry_v1_examples.yaml');

try {
  const seed = await loadSeedYaml(source);

  for (const item of seed.publication_policies ?? []) {
    await registry.upsertPublicationPolicy(hydratePublicationPolicy(item));
  }

  for (const item of seed.approver_groups ?? []) {
    await registry.upsertApproverGroup(item);
  }

  for (const item of seed.scope_registry ?? []) {
    await registry.upsertScope(hydrateScope(item));
  }

  console.log(`Registry seeded from ${source}`);
} finally {
  await sql.end({ timeout: 5 });
}
