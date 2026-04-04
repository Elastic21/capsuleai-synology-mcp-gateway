import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { loadEnv } from '@cybergogne/common';
import { createSqlClient, migrateDirectory } from '@cybergogne/registry';

const env = loadEnv();
const maxAttempts = Math.max(1, Number(process.env.MIGRATE_MAX_ATTEMPTS ?? '30'));
const retryDelayMs = Math.max(250, Number(process.env.MIGRATE_RETRY_DELAY_MS ?? '3000'));
const migrationsDir = path.resolve(process.cwd(), 'db/migrations');

let lastError;

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const sql = createSqlClient(env.DATABASE_URL);

  try {
    await migrateDirectory(sql, migrationsDir);
    console.log(`Migrations applied from ${migrationsDir}.`);
    await sql.end({ timeout: 5 });
    process.exit(0);
  } catch (error) {
    lastError = error;
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`Migration attempt ${attempt}/${maxAttempts} failed: ${reason}`);
    await sql.end({ timeout: 5 }).catch(() => undefined);

    if (attempt < maxAttempts) {
      console.warn(`Retrying migrations in ${retryDelayMs} ms...`);
      await delay(retryDelayMs);
    }
  }
}

throw lastError ?? new Error('Migration failed without a captured error');
