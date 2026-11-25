import type { WorkStore, WorkUnit } from '../application/ports.js';
import {
  WorkError,
  type CommandResult,
  type Source,
  type Task,
  type WorkEvent,
} from '../domain/work.js';
import type { Database, Queryable } from './database.js';
import { DEFAULT_CONTEXT } from '../domain/context.js';

type StoredTask = Omit<Task, 'context'> & { context?: string };
function hydrate(task: StoredTask): Task {
  return { ...task, context: task.context ?? DEFAULT_CONTEXT };
}

class SqlWorkUnit implements WorkUnit {
  constructor(private readonly db: Queryable) {}
  async task(id: string) {
    const row = (
      await this.db.query<{ document: StoredTask }>(
        'SELECT document FROM wid_tasks WHERE id=$1 FOR UPDATE',
        [id],
      )
    ).rows[0]?.document;
    return row ? hydrate(row) : undefined;
  }
  async saveTask(task: Task, create = false) {
    await this.db.query(
      create
        ? 'INSERT INTO wid_tasks(id,document) VALUES ($1,$2)'
        : 'UPDATE wid_tasks SET document=$2 WHERE id=$1',
      [task.id, JSON.stringify(task)],
    );
  }
  async event(id: string) {
    return (
      await this.db.query<{ document: WorkEvent }>('SELECT document FROM wid_events WHERE id=$1', [
        id,
      ])
    ).rows[0]?.document;
  }
  async append(event: WorkEvent) {
    if (event.correctsEventId) {
      const prior = await this.db.query(
        "SELECT id FROM wid_events WHERE document->>'correctsEventId'=$1",
        [event.correctsEventId],
      );
      if (prior.rows.length)
        throw new WorkError(
          'Este evento já possui correção. Registre uma nota para detalhar.',
          409,
        );
    }
    await this.db.query('INSERT INTO wid_events(id,task_id,document) VALUES ($1,$2,$3)', [
      event.id,
      event.taskId,
      JSON.stringify(event),
    ]);
  }
}
export class SqlWorkStore implements WorkStore {
  constructor(private readonly db: Database) {}
  command(
    source: Source,
    key: string,
    fingerprint: string,
    action: (unit: WorkUnit) => Promise<CommandResult>,
  ) {
    return this.db.transaction(async (tx) => {
      const claimed = await tx.query(
        'INSERT INTO wid_commands(source,key,fingerprint) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING key',
        [source.agent, key, fingerprint],
      );
      if (!claimed.rows.length) {
        const prior = (
          await tx.query<{ fingerprint: string; result: CommandResult }>(
            'SELECT fingerprint,result FROM wid_commands WHERE source=$1 AND key=$2',
            [source.agent, key],
          )
        ).rows[0];
        if (prior.fingerprint !== fingerprint)
          throw new WorkError('Chave idempotente já usada com conteúdo diferente.', 409);
        return { ...prior.result, task: hydrate(prior.result.task) };
      }
      const result = await action(new SqlWorkUnit(tx));
      await tx.query('UPDATE wid_commands SET result=$3 WHERE source=$1 AND key=$2', [
        source.agent,
        key,
        JSON.stringify(result),
      ]);
      return result;
    });
  }
  async tasks() {
    return (
      await this.db.query<{ document: StoredTask }>(
        "SELECT document FROM wid_tasks ORDER BY document->>'updatedAt' DESC",
      )
    ).rows.map((row) => hydrate(row.document));
  }
  async events() {
    return (
      await this.db.query<{ document: WorkEvent }>(
        'SELECT document FROM wid_events ORDER BY sequence',
      )
    ).rows.map((row) => row.document);
  }
}
