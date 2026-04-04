import path from 'node:path';
import { loadEnv } from '@cybergogne/common';
import { createSqlClient, migrateDirectory } from '@cybergogne/registry';

const env = loadEnv();
const sql = createSqlClient(env.DATABASE_URL);

try {
  await migrateDirectory(sql, path.resolve(process.cwd(), 'db/migrations'));
  console.log('Migrations applied.');
} finally {
  await sql.end({ timeout: 5 });
}
