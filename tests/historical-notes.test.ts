import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, migrate, type Database } from '../src/infrastructure/database.js';
import { SqlWorkStore } from '../src/infrastructure/work-store.js';
import { WorkService } from '../src/application/work-service.js';
import { monthReport, summarize, statuses } from '../src/domain/work.js';

let db: Database;
let work: WorkService;
const source = { agent: 'test', sessionId: 'history-session', chatUrl: 'thread://history-source' };
const fixedNow = '2026-11-25T15:00:00.000Z';
before(async () => {
  db = await openDatabase('memory://');
  await migrate(db);
  work = new WorkService(new SqlWorkStore(db), () => fixedNow);
});
after(async () => {
  await db.close();
});

test('historical facts preserve all task states, references and unknown time despite reverse recording order', async () => {
  for (const status of statuses) {
    const { task } = await work.create(
      {
        title: `Historic ${status}`,
        context: 'Free research',
        references: [{ label: 'Current link', url: 'https://example.com/current' }],
        idempotencyKey: randomUUID(),
      },
      source,
    );
    if (status !== 'planned')
      await work.record(
        {
          taskId: task.id,
          kind: status === 'active' ? 'started' : status,
          note: 'Current lifecycle state',
          idempotencyKey: randomUUID(),
        },
        source,
      );
    const original = (await work.detail(task.id, 'America/Sao_Paulo')).task;
    for (const occurredAt of ['2026-11-10T10:00:00-03:00', '2026-11-04T01:15:00Z']) {
      const input = {
        taskId: task.id,
        kind: 'historical_note',
        note: 'Historical fact with source, duration unknown.',
        occurredAt,
        references: [{ label: 'Historical source', url: 'https://example.com/history' }],
        idempotencyKey: randomUUID(),
      };
      const first = await work.record(input, source);
      assert.equal(first.task.status, status);
      assert.equal(first.task.context, original.context);
      assert.equal(first.task.createdAt, original.createdAt);
      assert.deepEqual(first.task.references, original.references);
      assert.equal(first.event.occurredAt, occurredAt);
      assert.equal(first.event.recordedAt, fixedNow);
      assert.deepEqual(first.event.source, source);
      assert.deepEqual(first.event.references, input.references);
      assert.equal(first.event.context, 'Free research');
      assert.equal(first.event.effort, undefined);
      assert.deepEqual(await work.record(input, source), JSON.parse(JSON.stringify(first)));
      await assert.rejects(
        work.record({ ...input, note: 'Different fact under same key' }, source),
        /different content/,
      );
    }
    const detail = await work.detail(task.id, 'America/Sao_Paulo', 'free research');
    assert.equal(detail.task.status, status);
    assert.deepEqual(
      detail.days.map((day) => day.day),
      ['2026-11-25', '2026-11-10', '2026-11-03'],
    );
    const day = summarize(detail.events, '2026-11-03', 'America/Sao_Paulo');
    assert.equal(day.events, 1);
    assert.equal(day.coverage, 'partial');
    assert.equal(day.humanTimeRecorded, false);
    assert.equal(day.humanMinutes, 0);
    const month = monthReport(detail.events, '2026-11', 'America/Sao_Paulo');
    assert.equal(month.coveredDays, 3);
    assert.equal(month.totals.humanMinutes, 0);
    if (status === 'completed' || status === 'cancelled')
      for (const kind of ['started', 'progressed', 'completed'] as const)
        await assert.rejects(
          work.record(
            {
              taskId: task.id,
              kind,
              note: 'Invalid lifecycle backfill',
              occurredAt: '2026-11-03T10:00:00-03:00',
              idempotencyKey: randomUUID(),
            },
            source,
          ),
          /closed/,
        );
  }
});

test('historical notes require a real timestamp and reject effort, context changes, fake corrections and unsafe sources atomically', async () => {
  const { task } = await work.create(
    { title: 'Invalid history inputs', idempotencyKey: randomUUID() },
    source,
  );
  const input = {
    taskId: task.id,
    kind: 'historical_note',
    note: 'Past fact',
    occurredAt: '2026-11-03T10:00:00-03:00',
    idempotencyKey: randomUUID(),
  };
  for (const invalid of [
    { occurredAt: undefined },
    { occurredAt: '2026-11-03T10:00:00' },
    { occurredAt: '2026-11-25T15:00:01Z' },
    { note: ' ' },
    { effort: { day: '2026-11-03', category: 'human_estimated', minutes: 30, confidence: 'low' } },
    { context: 'Another group' },
    { correctsEventId: randomUUID() },
    { references: [{ label: 'Unsafe', url: 'javascript:alert(1)' }] },
  ])
    await assert.rejects(work.record({ ...input, ...invalid }, source));
  await assert.rejects(work.record({ ...input, taskId: randomUUID() }, source), /not found/);
  assert.equal((await work.detail(task.id, 'America/Sao_Paulo')).events.length, 1);
  const valid = await work.record({ ...input, references: [] }, source);
  assert.equal(valid.task.status, 'planned');
  assert.equal((await work.detail(task.id, 'America/Sao_Paulo')).events.length, 2);
});
