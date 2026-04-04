import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SqlClient } from './db.js';

export async function migrateDirectory(sql: SqlClient, directory: string): Promise<void> {
  await sql`create table if not exists cg_schema_migration (
    filename text primary key,
    checksum text not null,
    applied_at timestamptz not null default now()
  )`;

  const files = (await readdir(directory))
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    const fullPath = path.join(directory, file);
    const content = await readFile(fullPath, 'utf8');
    const checksum = createHash('sha256').update(content).digest('hex');
    const already = await sql<{ filename: string; checksum: string }[]>`
      select filename, checksum from cg_schema_migration where filename = ${file}
    `;
    if (already.length > 0) {
      if (already[0].checksum !== checksum) {
        throw new Error(`Migration checksum changed for ${file}`);
      }
      continue;
    }
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx.unsafe(
        'insert into cg_schema_migration (filename, checksum) values ($1, $2)',
        [file, checksum],
      );
    });
  }
}
