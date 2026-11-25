import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase, migrate, type Database } from '../src/infrastructure/database.js';
import { SqlWorkStore } from '../src/infrastructure/work-store.js';
import { WorkService } from '../src/application/work-service.js';
import { localDay, monthReport, summarize, type WorkEvent } from '../src/domain/work.js';

let directory: string;
let db: Database;
let work: WorkService;
const identity = { agent: 'test', sessionId: 'session-one' };
const now = () => '2026-11-25T15:00:00.000Z';
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'wid-test-'));
  db = await openDatabase(join(directory, 'pg'));
  await migrate(db);
  work = new WorkService(new SqlWorkStore(db), now);
});
after(async () => {
  await db.close();
  await rm(directory, { recursive: true, force: true });
});

test('create is atomic and retries are idempotent, including concurrent calls', async () => {
  const input = { title: 'Test task', idempotencyKey: randomUUID() };
  const [first, second] = await Promise.all([
    work.create(input, identity),
    work.create(input, identity),
  ]);
  assert.deepEqual(first, second);
  await assert.rejects(
    work.create({ ...input, title: 'Changed content' }, identity),
    /different content/,
  );
});

test('task detail isolates full history across months and preserves cumulative human accounting', async () => {
  const { task } = await work.create(
    { title: 'Detail totals', context: 'Free context', idempotencyKey: randomUUID() },
    identity,
  );
  for (const [day, category, minutes] of [
    ['2026-10-31', 'human_estimated', 30],
    ['2026-11-24', 'human_estimated', 40],
    ['2026-11-24', 'human_estimated', 60],
    ['2026-11-24', 'human_measured', 20],
    ['2026-11-24', 'agent_run', 300],
    ['2026-11-24', 'wait', 90],
  ] as const)
    await work.record(
      {
        taskId: task.id,
        kind: 'effort',
        note: 'Synthetic effort',
        effort: { day, category, minutes, confidence: 'low' },
        idempotencyKey: randomUUID(),
      },
      identity,
    );
  const detail = await work.detail(task.id, 'America/Sao_Paulo');
  assert.equal(detail.task.context, 'Free context');
  assert.equal(detail.events.length, 7);
  assert.ok(detail.events.every((event) => event.taskId === task.id));
  assert.deepEqual(detail.totals, {
    humanMinutes: 90,
    measuredMinutes: 20,
    estimatedMinutes: 70,
    agentMinutes: 300,
    waitMinutes: 90,
  });
  assert.deepEqual(
    detail.days.map((day) => day.day),
    ['2026-11-25', '2026-11-24', '2026-10-31'],
  );
  assert.equal(detail.daysWithoutTime, 1);
  await work.record(
    {
      taskId: task.id,
      kind: 'effort',
      note: 'Explicit zero measurement',
      effort: { day: '2026-11-25', category: 'human_measured', minutes: 0 },
      idempotencyKey: randomUUID(),
    },
    identity,
  );
  const zero = await work.detail(task.id, 'America/Sao_Paulo');
  assert.equal(zero.days[0].humanTimeRecorded, true);
  assert.equal(zero.daysWithoutTime, 0);
  await assert.rejects(work.detail(randomUUID(), 'America/Sao_Paulo'), /not found/);
});

test('adding references is audited, idempotent and works on completed tasks without duplicating them', async () => {
  const ref = { label: 'Issue', url: 'https://github.com/example/project/issues/1' };
  const { task } = await work.create(
    { title: 'References', references: [ref], idempotencyKey: randomUUID() },
    identity,
  );
  await work.record(
    { taskId: task.id, kind: 'completed', note: 'Done', idempotencyKey: randomUUID() },
    identity,
  );
  const input = {
    taskId: task.id,
    kind: 'references_added',
    references: [ref, { label: 'Discussion', url: 'https://example.slack.com/archives/C1/p123' }],
    note: 'Link to existing discussion',
    idempotencyKey: randomUUID(),
  };
  const added = await work.record(input, identity);
  assert.equal(added.task.id, task.id);
  assert.equal(added.task.status, 'completed');
  assert.equal(added.task.references.length, 2);
  assert.equal(added.event.references?.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(added)), await work.record(input, identity));
  await assert.rejects(
    work.record({ ...input, references: undefined, idempotencyKey: randomUUID() }, identity),
  );
  await assert.rejects(
    work.record({ ...input, kind: 'progressed', idempotencyKey: randomUUID() }, identity),
  );
  await assert.rejects(
    work.record(
      {
        ...input,
        references: [{ label: 'Unsafe', url: 'javascript:alert(1)' }],
        idempotencyKey: randomUUID(),
      },
      identity,
    ),
  );
  await assert.rejects(
    work.record(
      {
        ...input,
        references: Array.from({ length: 20 }, (_, i) => ({
          label: `Ref ${i}`,
          url: `https://example.com/${i}`,
        })),
        idempotencyKey: randomUUID(),
      },
      identity,
    ),
    /at most 20/,
  );
  const detail = await work.detail(task.id, 'America/Sao_Paulo');
  assert.equal(detail.task.references.length, 2);
  assert.equal(detail.events.length, 3);
});
test('state transition failure rolls back its event and idempotency claim', async () => {
  const { task } = await work.create(
    { title: 'Finish task', idempotencyKey: randomUUID() },
    identity,
  );
  await work.record(
    { taskId: task.id, kind: 'completed', note: 'Done', idempotencyKey: randomUUID() },
    identity,
  );
  const key = randomUUID();
  await assert.rejects(
    work.record({ taskId: task.id, kind: 'started', note: 'Again', idempotencyKey: key }, identity),
    /closed/,
  );
  await work.record(
    { taskId: task.id, kind: 'decided', note: 'Follow-up', idempotencyKey: key },
    identity,
  );
  const snapshot = await work.snapshot();
  assert.equal(snapshot.events.filter((event) => event.taskId === task.id).length, 3);
});
test('day and month total snapshots replace estimates, measured overlaps, runtime excluded', () => {
  const event = (
    category: 'human_estimated' | 'human_measured' | 'agent_run' | 'wait',
    minutes: number,
    revision: number,
    taskId = 'one',
  ): WorkEvent => ({
    id: String(revision),
    taskId,
    kind: 'effort',
    source: identity,
    note: 'Evidence',
    occurredAt: '2026-11-25T12:00:00-03:00',
    recordedAt: `2026-11-25T15:00:${String(revision).padStart(2, '0')}Z`,
    effort: { category, minutes, day: '2026-11-25', confidence: 'medium' },
  });
  const events = [
    event('human_estimated', 40, 1),
    event('human_estimated', 60, 2),
    event('human_measured', 30, 3),
    event('agent_run', 120, 4),
    event('wait', 90, 5),
    event('human_estimated', 45, 6, 'two'),
  ];
  const day = summarize(events, '2026-11-25', 'America/Sao_Paulo');
  assert.equal(day.humanMinutes, 105);
  assert.equal(day.minutes.human_measured, 30);
  assert.equal(day.minutes.human_estimated, 75);
  assert.equal(day.minutes.agent_run, 120);
  const month = monthReport(events, '2026-11', 'America/Sao_Paulo', '2026-11-25');
  assert.equal(month.totals.humanMinutes, 105);
  assert.equal(month.coveredDays, 1);
  assert.equal(month.unknownDays, 24);
  assert.equal(month.coverage, 'partial');
});
test('correction preserves original and replaces effort without double counting', async () => {
  const { task } = await work.create(
    { title: 'Correct effort', idempotencyKey: randomUUID() },
    identity,
  );
  const first = await work.record(
    {
      taskId: task.id,
      kind: 'effort',
      note: 'Initial assumption',
      effort: { category: 'human_estimated', day: '2026-11-24', minutes: 90, confidence: 'low' },
      idempotencyKey: randomUUID(),
    },
    identity,
  );
  const correction = {
    taskId: task.id,
    kind: 'corrected',
    correctsEventId: first.event.id,
    note: 'User clarified',
    effort: { category: 'human_estimated', day: '2026-11-24', minutes: 45, confidence: 'high' },
    idempotencyKey: randomUUID(),
  };
  await work.record(correction, identity);
  await assert.rejects(
    work.record({ ...correction, idempotencyKey: randomUUID() }, identity),
    /already has a correction/,
  );
  const { events } = await work.snapshot();
  const own = events.filter((event) => event.taskId === task.id);
  assert.equal(own.length, 3);
  assert.equal(own[1].effort?.minutes, 90);
  assert.equal(summarize(own, '2026-11-24', 'America/Sao_Paulo').humanMinutes, 45);
});
test('historical offsets use São Paulo local day and invalid dates/future work fail', async () => {
  assert.equal(localDay('2026-11-25T01:30:00Z'), '2026-11-24');
  const { task } = await work.create(
    {
      title: 'Historical task',
      occurredAt: '2026-11-24T22:30:00-03:00',
      idempotencyKey: randomUUID(),
    },
    identity,
  );
  await assert.rejects(
    work.record(
      {
        taskId: task.id,
        kind: 'effort',
        note: 'Invalid date',
        effort: { category: 'human_estimated', day: '2026-02-30', minutes: 60, confidence: 'low' },
        idempotencyKey: randomUUID(),
      },
      identity,
    ),
  );
  await assert.rejects(
    work.create(
      { title: 'Future event', occurredAt: '2027-01-01T00:00:00Z', idempotencyKey: randomUUID() },
      identity,
    ),
    /past timestamp/,
  );
});
test('embedded PostgreSQL survives closing and reopening', async () => {
  const count = (await work.snapshot()).tasks.length;
  await db.close();
  db = await openDatabase(join(directory, 'pg'));
  work = new WorkService(new SqlWorkStore(db), now);
  assert.equal((await work.snapshot()).tasks.length, count);
});
