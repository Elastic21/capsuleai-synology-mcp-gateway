import postgres from 'postgres';

export function createSqlClient(databaseUrl: string) {
  return postgres(databaseUrl, {
    max: 10,
    idle_timeout: 5,
    connect_timeout: 10,
  });
}

export type SqlClient = ReturnType<typeof createSqlClient>;
