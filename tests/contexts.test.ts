import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase, migrate, type Database } from '../src/infrastructure/database.js';
import { SqlWorkStore } from '../src/infrastructure/work-store.js';
import { WorkService } from '../src/application/work-service.js';
import { summarize } from '../src/domain/work.js';

let directory: string;
let db: Database;
let service: WorkService;
const source = { agent: 'contexts-test' };
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'wid-contexts-'));
  db = await openDatabase(join(directory, 'pg'));
  await migrate(db);
  service = new WorkService(new SqlWorkStore(db), () => '2026-11-25T15:00:00Z');
});
after(async () => {
  await db.close();
  await rm(directory, { recursive: true, force: true });
});

test('arbitrary contexts are dynamic; grouping ignores case, accents and repeated spaces', async () => {
  const first = await service.create(
    { title: 'A', context: 'Résumé review', idempotencyKey: randomUUID() },
    source,
  );
  await service.create(
    { title: 'B', context: 'resume    review', idempotencyKey: randomUUID() },
    source,
  );
  await service.create(
    { title: 'C', context: 'Client Ω / discovery', idempotencyKey: randomUUID() },
    source,
  );
  const groups = await service.contexts();
  assert.equal(groups.length, 2);
  assert.equal(groups.find((group) => group.name === 'Résumé review')?.taskCount, 2);
  const scoped = await service.snapshot(' RESUME REVIEW ');
  assert.equal(scoped.tasks.length, 2);
  assert.ok(scoped.tasks.some((task) => task.id === first.task.id));
  assert.equal((await service.snapshot('Not present')).tasks.length, 0);
  await assert.rejects(
    service.create({ title: 'Invalid', context: '  ', idempotencyKey: randomUUID() }, source),
  );
});

test('reclassification retains ID, audit history, effort and terminal state', async () => {
  const { task } = await service.create(
    { title: 'Completed work', context: 'Before', idempotencyKey: randomUUID() },
    source,
  );
  await service.record(
    { taskId: task.id, kind: 'completed', note: 'Done', idempotencyKey: randomUUID() },
    source,
  );
  await service.record(
    {
      taskId: task.id,
      kind: 'effort',
      note: 'Conversation estimate',
      effort: { category: 'human_estimated', day: '2026-11-25', minutes: 45, confidence: 'low' },
      idempotencyKey: randomUUID(),
    },
    source,
  );
  const input = {
    taskId: task.id,
    kind: 'context_changed',
    context: 'After / custom',
    note: 'Reclassified',
    idempotencyKey: randomUUID(),
  };
  const first = await service.record(input, source);
  assert.deepEqual(await service.record(input, source), JSON.parse(JSON.stringify(first)));
  assert.equal(first.task.id, task.id);
  assert.equal(first.task.status, 'completed');
  assert.equal(first.event.previousContext, 'Before');
  assert.equal(first.event.context, 'After / custom');
  const before = await service.snapshot('Before');
  assert.equal(before.tasks.length, 0);
  assert.equal(before.events.length, 0);
  const after = await service.snapshot('After / custom');
  assert.equal(after.tasks.length, 1);
  assert.equal(after.events.length, 4);
  assert.equal(summarize(after.events, '2026-11-25', 'America/Sao_Paulo').humanMinutes, 45);
  await assert.rejects(
    service.record(
      {
        taskId: task.id,
        kind: 'progressed',
        context: 'Hidden move',
        note: 'Invalid',
        idempotencyKey: randomUUID(),
      },
      source,
    ),
  );
  await assert.rejects(
    service.record(
      {
        taskId: task.id,
        kind: 'context_changed',
        note: 'Missing context',
        idempotencyKey: randomUUID(),
      },
      source,
    ),
  );
});

test('legacy task documents and idempotency receipts remain readable without context', async () => {
  const input = { title: 'Legacy', company: 'Original company', idempotencyKey: randomUUID() };
  const { task } = await service.create(input, source);
  await db.query("UPDATE wid_tasks SET document=document-'context' WHERE id=$1", [task.id]);
  await db.query(
    "UPDATE wid_commands SET result=jsonb_set(result,'{task}',(result->'task')-'context') WHERE source=$1 AND key=$2",
    [source.agent, input.idempotencyKey],
  );
  const replay = await service.create(input, source);
  assert.equal(replay.task.id, task.id);
  assert.equal(replay.task.context, 'OUTROS');
  const legacy = await service.snapshot('OUTROS');
  assert.ok(
    legacy.tasks.some((item) => item.id === task.id && item.company === 'Original company'),
  );
});
