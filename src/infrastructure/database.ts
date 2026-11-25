import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
export interface Database extends Queryable {
  transaction<T>(action: (query: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export async function openDatabase(directory: string, url?: string): Promise<Database> {
  if (!url) {
    const db = new PGlite(directory);
    await db.waitReady;
    return {
      query: (sql, params) => db.query(sql, params),
      transaction: (action) =>
        db.transaction((tx) => action({ query: (sql, params) => tx.query(sql, params) })),
      close: () => db.close(),
    };
  }
  const pool = new pg.Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 5000 });
  return {
    query: async (sql, params) => {
      const result = await pool.query(sql, params);
      return { rows: result.rows };
    },
    transaction: async (action) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await action({
          query: async (sql, params) => ({ rows: (await client.query(sql, params)).rows }),
        });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
export async function migrate(db: Database) {
  await db.transaction(async (tx) => {
    await tx.query(
      `CREATE TABLE IF NOT EXISTS wid_tasks (id uuid PRIMARY KEY, document jsonb NOT NULL)`,
    );
    await tx.query(
      `CREATE TABLE IF NOT EXISTS wid_events (id uuid PRIMARY KEY, task_id uuid NOT NULL REFERENCES wid_tasks(id), document jsonb NOT NULL)`,
    );
    await tx.query(`ALTER TABLE wid_events ADD COLUMN IF NOT EXISTS sequence bigint GENERATED ALWAYS AS IDENTITY`);
    await tx.query(`CREATE INDEX IF NOT EXISTS wid_events_task ON wid_events(task_id)`);
    await tx.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS wid_event_correction ON wid_events ((document->>'correctsEventId')) WHERE document->>'correctsEventId' IS NOT NULL`,
    );
    await tx.query(
      `CREATE TABLE IF NOT EXISTS wid_commands (source text NOT NULL, key text NOT NULL, fingerprint text NOT NULL, result jsonb, PRIMARY KEY(source,key))`,
    );
  });
}
