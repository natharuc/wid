import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, migrate } from '../src/infrastructure/database.js';
import { SqlWorkStore } from '../src/infrastructure/work-store.js';
import { WorkService } from '../src/application/work-service.js';
import { summarize } from '../src/domain/work.js';
import { structuredWorkSchema, type StructuredWork } from '../src/domain/work-evidence.js';
import { makeWorkDigest } from '../src/domain/work-digest.js';

const timezone = 'America/Sao_Paulo';
const now = '2026-11-25T15:00:00.000Z';
const source = { agent: 'test', sessionId: 'evidence-session', chatUrl: 'thread://evidence-chat' };

function fact(overrides: Partial<StructuredWork> = {}): StructuredWork {
  return {
    day: '2026-11-20',
    summary: 'Reviewed the receipt rules.',
    outcome: 'advanced',
    actor: 'human',
    evidence: [
      {
        id: randomUUID(),
        kind: 'human_message',
        summary: 'The user reports reviewing the rules.',
        sourceId: 'message-1',
      },
    ],
    ...overrides,
  };
}

async function fixture(t: TestContext) {
  const db = await openDatabase('memory://');
  t.after(() => db.close());
  await migrate(db);
  const work = new WorkService(new SqlWorkStore(db), () => now);
  const { task } = await work.create(
    {
      title: 'Review receipts',
      context: 'Client / Research',
      occurredAt: '2026-11-19T10:00:00-03:00',
      idempotencyKey: randomUUID(),
    },
    source,
  );
  return { work, task };
}

test('structured evidence persists original precision, source and episode without creating human time', async (t) => {
  const { work, task } = await fixture(t);
  const input = {
    taskId: task.id,
    kind: 'work_recorded',
    note: 'Review explicitly reported by the user.',
    references: [{ label: 'Review source', url: 'https://example.com/review' }],
    work: fact({
      episode: {
        id: 'episode-review',
        phase: 'review',
        window: { startedAt: '2026-11-20T10:00:00-03:00', endedAt: '2026-11-20T10:40:00-03:00' },
      },
    }),
    idempotencyKey: randomUUID(),
  };
  const first = await work.record(input, source);
  const replay = await work.record(input, source);
  assert.deepEqual(replay, JSON.parse(JSON.stringify(first)));
  assert.equal(first.task.status, 'planned');
  assert.deepEqual(first.event.source, source);
  assert.deepEqual(first.event.references, input.references);
  assert.deepEqual(first.task.references, []);
  assert.equal(first.event.recordedAt, now);
  assert.equal(first.event.work?.evidence[0].occurredAt, undefined);
  assert.equal(first.event.work?.evidence[0].day, undefined);
  assert.equal(first.event.work?.evidence[0].sourceId, 'message-1');
  await assert.rejects(work.record({ ...input, work: fact() }, source), /different content/);

  const snapshot = await work.snapshot();
  assert.equal(snapshot.events.filter((event) => event.taskId === task.id).length, 2);
  const report = summarize(snapshot.events, '2026-11-20', timezone);
  assert.equal(report.events, 1);
  assert.equal(report.humanMinutes, 0);
  assert.equal(report.humanTimeRecorded, false);
  assert.deepEqual(report.minutes, {
    human_measured: 0,
    human_estimated: 0,
    agent_run: 0,
    wait: 0,
  });
  const digest = makeWorkDigest(snapshot.tasks, snapshot.events, '2026-11-20', timezone);
  assert.equal(digest.items.length, 1);
  assert.equal(digest.items[0].facts[0].eventId, first.event.id);
  assert.equal(digest.items[0].facts[0].structured, true);
  assert.equal(digest.items[0].evidenceCount, 1);
  assert.deepEqual(digest.items[0].facts[0].episode, input.work.episode);
});

test('work_recorded preserves completed and cancelled lifecycle while task detail respects context', async (t) => {
  const { work, task } = await fixture(t);
  await work.record(
    {
      taskId: task.id,
      kind: 'completed',
      note: 'Current completion.',
      idempotencyKey: randomUUID(),
    },
    source,
  );
  const closed = await work.record(
    {
      taskId: task.id,
      kind: 'work_recorded',
      note: 'Earlier fact added.',
      work: fact(),
      idempotencyKey: randomUUID(),
    },
    source,
  );
  assert.equal(closed.task.status, 'completed');
  const detail = await work.detail(task.id, timezone, 'client / research');
  assert.equal(detail.task.status, 'completed');
  assert.ok(
    detail.digest.some(
      (day) => day.day === '2026-11-20' && day.items.some((item) => item.taskId === task.id),
    ),
  );
  await assert.rejects(work.detail(task.id, timezone, 'Other context'), /this context/);

  const { task: cancelled } = await work.create(
    { title: 'Cancelled', idempotencyKey: randomUUID() },
    source,
  );
  await work.record(
    {
      taskId: cancelled.id,
      kind: 'cancelled',
      note: 'Currently cancelled.',
      idempotencyKey: randomUUID(),
    },
    source,
  );
  assert.equal(
    (
      await work.record(
        {
          taskId: cancelled.id,
          kind: 'work_recorded',
          note: 'Earlier record.',
          work: fact(),
          idempotencyKey: randomUUID(),
        },
        source,
      )
    ).task.status,
    'cancelled',
  );
  await assert.rejects(
    work.record(
      { taskId: task.id, kind: 'started', note: 'Cannot reopen.', idempotencyKey: randomUUID() },
      source,
    ),
    /closed/,
  );
});

test('structured work validation rejects unsupported authorship, fake durations and ambiguous timestamps', () => {
  const base = fact();
  for (const invalid of [
    { ...base, summary: 'x'.repeat(281) },
    { ...base, day: '2026-02-31' },
    { ...base, evidence: [] },
    { ...base, evidence: [base.evidence[0], base.evidence[0]] },
    {
      ...base,
      actor: 'human',
      evidence: [{ id: 'tool-only', kind: 'tool_result', summary: 'Automated test passed.' }],
    },
    {
      ...base,
      actor: 'joint',
      evidence: [
        { id: 'agent-only', kind: 'agent_message', summary: 'Agent reported completion.' },
      ],
    },
    { ...base, minutes: 40 },
    { ...base, evidence: [{ ...base.evidence[0], minutes: 40 }] },
    { ...base, evidence: [{ ...base.evidence[0], occurredAt: '2026-11-20T10:00:00' }] },
    {
      ...base,
      evidence: [
        { ...base.evidence[0], occurredAt: '2026-11-20T10:00:00-03:00', day: '2026-11-20' },
      ],
    },
    { ...base, episode: { id: 'episode', phase: 'review', durationMinutes: 40 } },
    {
      ...base,
      episode: {
        id: 'episode',
        phase: 'review',
        window: { startedAt: '2026-11-20T11:00:00-03:00', endedAt: '2026-11-20T10:00:00-03:00' },
      },
    },
  ])
    assert.equal(structuredWorkSchema.safeParse(invalid).success, false);
  assert.equal(
    structuredWorkSchema.safeParse(
      fact({
        actor: 'agent',
        evidence: [
          {
            id: 'tool',
            kind: 'tool_result',
            summary: 'Automated test passed.',
            day: '2026-11-20',
          },
        ],
      }),
    ).success,
    true,
  );
});

test('recording evidence rejects future claims and administrative payloads atomically', async (t) => {
  const { work, task } = await fixture(t);
  const base = {
    taskId: task.id,
    kind: 'work_recorded',
    note: 'Record with evidence.',
    work: fact(),
    idempotencyKey: randomUUID(),
  };
  for (const invalid of [
    { ...base, work: undefined },
    { ...base, work: fact({ day: '2026-11-26' }) },
    {
      ...base,
      work: fact({
        evidence: [
          {
            id: 'future',
            kind: 'human_message',
            summary: 'Future fact.',
            occurredAt: '2026-11-26T10:00:00-03:00',
          },
        ],
      }),
    },
    {
      ...base,
      work: fact({
        evidence: [
          { id: 'future-day', kind: 'human_message', summary: 'Future fact.', day: '2026-11-26' },
        ],
      }),
    },
    {
      ...base,
      work: fact({
        episode: {
          id: 'future-window',
          phase: 'review',
          window: { startedAt: '2026-11-26T10:00:00-03:00', endedAt: '2026-11-26T10:40:00-03:00' },
        },
      }),
    },
    {
      ...base,
      effort: { category: 'human_estimated', day: '2026-11-20', minutes: 40, confidence: 'low' },
    },
    { ...base, kind: 'context_changed', context: 'Other' },
    {
      ...base,
      kind: 'references_added',
      references: [{ label: 'Reference', url: 'https://example.com/ref' }],
    },
    { ...base, kind: 'effort', effort: { category: 'agent_run', day: '2026-11-20', minutes: 40 } },
  ])
    await assert.rejects(work.record(invalid, source));
  assert.equal((await work.detail(task.id, timezone)).events.length, 1);
  assert.equal((await work.record(base, source)).task.status, 'planned');
});

test('administrative changes and effort do not become work facts; legacy notes remain attributed as unknown', async (t) => {
  const { work, task } = await fixture(t);
  await work.record(
    {
      taskId: task.id,
      kind: 'context_changed',
      context: 'New context',
      note: 'Administrative classification.',
      idempotencyKey: randomUUID(),
    },
    source,
  );
  await work.record(
    {
      taskId: task.id,
      kind: 'references_added',
      references: [{ label: 'Ref', url: 'https://example.com/ref' }],
      note: 'Administrative reference.',
      idempotencyKey: randomUUID(),
    },
    source,
  );
  await work.record(
    {
      taskId: task.id,
      kind: 'effort',
      effort: { category: 'agent_run', day: '2026-11-25', minutes: 60 },
      note: 'Automated execution.',
      idempotencyKey: randomUUID(),
    },
    source,
  );
  let snapshot = await work.snapshot();
  let digest = makeWorkDigest(snapshot.tasks, snapshot.events, '2026-11-25', timezone);
  assert.equal(digest.items.length, 0);
  assert.ok(digest.administrativeEvents >= 2);
  const legacy = await work.record(
    {
      taskId: task.id,
      kind: 'progressed',
      note: 'Identified the receipt discrepancy.',
      idempotencyKey: randomUUID(),
    },
    source,
  );
  snapshot = await work.snapshot('new context');
  digest = makeWorkDigest(snapshot.tasks, snapshot.events, '2026-11-25', timezone);
  assert.equal(digest.items.length, 1);
  const result = digest.items[0];
  assert.equal(result.context, 'New context');
  assert.equal(result.facts[0].eventId, legacy.event.id);
  assert.equal(result.facts[0].summary, legacy.event.note);
  assert.equal(result.facts[0].structured, false);
  assert.equal(result.facts[0].actor, 'unknown');
  assert.equal(result.facts[0].outcome, 'advanced');
  assert.equal(result.evidenceCount, 0);
});

test('planned facts stay planned and explicit corrections replace facts without deleting their evidence history', async (t) => {
  const { work } = await fixture(t);
  const planned = await work.create(
    {
      title: 'Plan validation',
      work: fact({ outcome: 'planned' }),
      idempotencyKey: randomUUID(),
    },
    source,
  );
  let snapshot = await work.snapshot();
  let digest = makeWorkDigest(
    snapshot.tasks.filter((task) => task.id === planned.task.id),
    snapshot.events,
    '2026-11-20',
    timezone,
  );
  assert.equal(digest.items[0].facts[0].outcome, 'planned');
  await assert.rejects(
    work.create(
      {
        title: 'False intention',
        work: fact({ outcome: 'delivered' }),
        idempotencyKey: randomUUID(),
      },
      source,
    ),
  );
  const original = await work.record(
    {
      taskId: planned.task.id,
      kind: 'work_recorded',
      note: 'First fact.',
      work: fact({ summary: 'Result recorded incorrectly.' }),
      idempotencyKey: randomUUID(),
    },
    source,
  );
  const corrected = await work.record(
    {
      taskId: planned.task.id,
      kind: 'corrected',
      correctsEventId: original.event.id,
      note: 'Correction based on another review.',
      work: fact({ day: '2026-11-21', summary: 'Corrected result supported by evidence.' }),
      idempotencyKey: randomUUID(),
    },
    source,
  );
  snapshot = await work.snapshot();
  digest = makeWorkDigest(
    snapshot.tasks.filter((task) => task.id === planned.task.id),
    snapshot.events,
    '2026-11-20',
    timezone,
  );
  const oldDayIds = digest.items.flatMap((item) => item.facts.map((value) => value.eventId));
  assert.ok(!oldDayIds.includes(original.event.id));
  const newDay = makeWorkDigest(snapshot.tasks, snapshot.events, '2026-11-21', timezone);
  assert.ok(
    newDay.items
      .flatMap((item) => item.facts)
      .some((value) => value.eventId === corrected.event.id),
  );
  assert.ok(snapshot.events.some((event) => event.id === original.event.id));
});

test('historical and start notes without structured work do not infer progress from the current lifecycle', async (t) => {
  const { work, task } = await fixture(t);
  await work.record(
    {
      taskId: task.id,
      kind: 'completed',
      note: 'Currently completed.',
      idempotencyKey: randomUUID(),
    },
    source,
  );
  const historical = await work.record(
    {
      taskId: task.id,
      kind: 'historical_note',
      note: 'Retrospective fact without structured classification.',
      occurredAt: '2026-11-20T10:00:00-03:00',
      idempotencyKey: randomUUID(),
    },
    source,
  );
  const snapshot = await work.snapshot();
  const digest = makeWorkDigest(snapshot.tasks, snapshot.events, '2026-11-20', timezone);
  assert.equal(digest.items[0].facts[0].eventId, historical.event.id);
  assert.equal(digest.items[0].facts[0].outcome, 'recorded');
  assert.equal(digest.items[0].facts[0].actor, 'unknown');
  const { task: opened } = await work.create(
    { title: 'Start without a result', idempotencyKey: randomUUID() },
    source,
  );
  const started = await work.record(
    {
      taskId: opened.id,
      kind: 'started',
      note: 'Start recorded without a verified result.',
      idempotencyKey: randomUUID(),
    },
    source,
  );
  const current = await work.snapshot();
  const today = makeWorkDigest(current.tasks, current.events, '2026-11-25', timezone);
  assert.equal(
    today.items.flatMap((item) => item.facts).find((value) => value.eventId === started.event.id)
      ?.outcome,
    'recorded',
  );
});

test('immutable evidence cannot be silently changed and effort-only corrections do not erase legacy facts', async (t) => {
  const { work, task } = await fixture(t);
  const observation = fact();
  await work.record(
    {
      taskId: task.id,
      kind: 'work_recorded',
      note: 'First use of the observation.',
      work: observation,
      idempotencyKey: randomUUID(),
    },
    source,
  );
  await assert.rejects(
    work.record(
      {
        taskId: task.id,
        kind: 'work_recorded',
        note: 'Attempt to change the same observation.',
        work: {
          ...observation,
          evidence: [{ ...observation.evidence[0], summary: 'Another incompatible statement.' }],
        },
        idempotencyKey: randomUUID(),
      },
      source,
    ),
    (error) => error instanceof Error && 'status' in error && error.status === 409,
  );
  const legacy = await work.record(
    {
      taskId: task.id,
      kind: 'progressed',
      note: 'Validated the legacy behavior.',
      effort: { day: '2026-11-22', category: 'human_estimated', minutes: 30, confidence: 'low' },
      idempotencyKey: randomUUID(),
    },
    source,
  );
  await work.record(
    {
      taskId: task.id,
      kind: 'corrected',
      correctsEventId: legacy.event.id,
      note: 'Corrected only the time.',
      effort: { day: '2026-11-22', category: 'human_estimated', minutes: 15, confidence: 'low' },
      idempotencyKey: randomUUID(),
    },
    source,
  );
  const snapshot = await work.snapshot();
  const digest = makeWorkDigest(snapshot.tasks, snapshot.events, '2026-11-22', timezone);
  assert.ok(digest.items[0].facts.some((value) => value.eventId === legacy.event.id));
  assert.equal(summarize(snapshot.events, '2026-11-22', timezone).humanMinutes, 15);
});

test('episode revisions and equivalent statements consolidate while the audit trail remains append-only', async (t) => {
  const { work, task } = await fixture(t);
  const episode = { id: 'review-episode', phase: 'review' } as const;
  await work.record(
    {
      taskId: task.id,
      kind: 'work_recorded',
      note: 'Initial review.',
      work: fact({ summary: 'Review in progress.', episode }),
      idempotencyKey: randomUUID(),
    },
    source,
  );
  const last = await work.record(
    {
      taskId: task.id,
      kind: 'work_recorded',
      note: 'Final review.',
      work: fact({ summary: 'Review completed.', outcome: 'delivered', episode }),
      idempotencyKey: randomUUID(),
    },
    source,
  );
  let snapshot = await work.snapshot();
  let digest = makeWorkDigest(snapshot.tasks, snapshot.events, '2026-11-20', timezone);
  assert.equal(digest.items[0].facts.length, 1);
  assert.equal(digest.items[0].facts[0].eventId, last.event.id);
  const repeated = fact({ summary: 'Another validation completed.' });
  for (let index = 0; index < 2; index++)
    await work.record(
      {
        taskId: task.id,
        kind: 'work_recorded',
        note: 'Same statement in another record.',
        work: repeated,
        idempotencyKey: randomUUID(),
      },
      source,
    );
  for (let index = 0; index < 4; index++)
    await work.record(
      {
        taskId: task.id,
        kind: 'work_recorded',
        note: `Progress ${index}.`,
        work: fact({ summary: `Distinct result ${index}.` }),
        idempotencyKey: randomUUID(),
      },
      source,
    );
  snapshot = await work.snapshot();
  digest = makeWorkDigest(snapshot.tasks, snapshot.events, '2026-11-20', timezone);
  assert.equal(digest.items[0].facts.length, 3);
  assert.equal(new Set(digest.items[0].facts.map((value) => value.summary)).size, 3);
  assert.equal(snapshot.events.filter((event) => event.taskId === task.id).length, 9);
});

test('administrative corrections remain audit-only instead of becoming accomplishments', async (t) => {
  const { work, task } = await fixture(t);
  for (const change of [
    { kind: 'context_changed', context: 'Corrected context' },
    {
      kind: 'references_added',
      references: [{ label: 'Reference', url: 'https://example.com/source' }],
    },
  ]) {
    const original = await work.record(
      {
        taskId: task.id,
        ...change,
        note: 'Administrative update.',
        idempotencyKey: randomUUID(),
      },
      source,
    );
    await work.record(
      {
        taskId: task.id,
        kind: 'corrected',
        correctsEventId: original.event.id,
        note: 'Clarified only the administrative update.',
        idempotencyKey: randomUUID(),
      },
      source,
    );
  }
  const snapshot = await work.snapshot();
  const digest = makeWorkDigest(snapshot.tasks, snapshot.events, '2026-11-25', timezone);
  assert.deepEqual(digest.items, []);
  assert.ok(digest.administrativeEvents >= 2);
  assert.equal(snapshot.events.filter((event) => event.kind === 'corrected').length, 2);
  assert.equal(snapshot.events.filter((event) => event.taskId === task.id).length, 5);
});

test('correcting a structured fact requires replacement work and rejection preserves its original day and audit', async (t) => {
  const { work, task } = await fixture(t);
  const original = await work.record(
    {
      taskId: task.id,
      kind: 'work_recorded',
      note: 'Structured fact on the original day.',
      work: fact(),
      idempotencyKey: randomUUID(),
    },
    source,
  );
  const before = await work.snapshot();
  const correction = {
    taskId: task.id,
    kind: 'corrected',
    correctsEventId: original.event.id,
    note: 'Attempt to correct without providing the replacement fact.',
    idempotencyKey: randomUUID(),
  };
  await assert.rejects(work.record(correction, source), /work/);
  const unchanged = await work.snapshot();
  assert.deepEqual(unchanged, before);
  const originalDay = makeWorkDigest(unchanged.tasks, unchanged.events, '2026-11-20', timezone);
  assert.equal(originalDay.items[0].facts[0].eventId, original.event.id);
  assert.equal(originalDay.items[0].facts[0].summary, original.event.work?.summary);
  assert.equal(originalDay.items[0].facts[0].structured, true);

  const replacement = await work.record(
    {
      ...correction,
      note: 'Fact correction with explicit evidence and day.',
      work: fact({ day: '2026-11-21', summary: 'Review confirmed on the corrected day.' }),
    },
    source,
  );
  const after = await work.snapshot();
  assert.equal(after.events.length, before.events.length + 1);
  assert.deepEqual(
    after.events.find((event) => event.id === original.event.id),
    before.events.find((event) => event.id === original.event.id),
  );
  assert.equal(replacement.task.status, original.task.status);
  assert.deepEqual(makeWorkDigest(after.tasks, after.events, '2026-11-20', timezone).items, []);
  const correctedDay = makeWorkDigest(after.tasks, after.events, '2026-11-21', timezone);
  assert.equal(correctedDay.items[0].facts[0].eventId, replacement.event.id);
  assert.equal(correctedDay.items[0].facts[0].summary, 'Review confirmed on the corrected day.');
});

test('concurrent agents cannot persist conflicting payloads for the same immutable evidence', async (t) => {
  const { work, task } = await fixture(t);
  const evidenceId = 'shared-human-observation';
  const inputs = ['Review approved by the user.', 'Review rejected by the user.'].map(
    (summary, index) => ({
      input: {
        taskId: task.id,
        kind: 'work_recorded',
        note: 'Agent records the shared observation.',
        work: fact({
          summary,
          evidence: [
            { id: evidenceId, kind: 'human_message', summary, sourceId: 'shared-message' },
          ],
        }),
        idempotencyKey: randomUUID(),
      },
      source: { agent: `concurrent-agent-${index}`, sessionId: `concurrent-session-${index}` },
    }),
  );
  const results = await Promise.allSettled(
    inputs.map((value) => work.record(value.input, value.source)),
  );
  const fulfilled = results.filter((result) => result.status === 'fulfilled');
  const rejected = results.filter((result) => result.status === 'rejected');
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.status, 409);

  const winner = fulfilled[0].value;
  const snapshot = await work.snapshot();
  assert.equal(snapshot.events.length, 2);
  assert.equal(snapshot.events.filter((event) => event.kind === 'planned').length, 1);
  assert.equal(
    snapshot.events.filter((event) => event.work?.evidence.some((item) => item.id === evidenceId))
      .length,
    1,
  );
  const persisted = snapshot.events.find((event) => event.id === winner.event.id);
  assert.deepEqual(persisted, JSON.parse(JSON.stringify(winner.event)));
  assert.equal(snapshot.tasks[0].status, 'planned');
  assert.ok(snapshot.events.every((event) => event.effort === undefined));
  const digest = makeWorkDigest(snapshot.tasks, snapshot.events, '2026-11-20', timezone);
  assert.equal(digest.items[0].facts.length, 1);
  assert.equal(digest.items[0].facts[0].eventId, winner.event.id);
  assert.equal(digest.items[0].evidenceCount, 1);
  const time = summarize(snapshot.events, '2026-11-20', timezone);
  assert.equal(time.humanMinutes, 0);
  assert.equal(time.humanTimeRecorded, false);
});

test('day-only evidence can be reused at a new checkpoint after JSONB persistence and rereading', async (t) => {
  const { work, task } = await fixture(t);
  const observation = {
    id: 'day-only-observation',
    kind: 'human_message',
    summary: 'The user reports the review.',
    day: '2026-11-20',
  } as const;
  const first = await work.record(
    {
      taskId: task.id,
      kind: 'work_recorded',
      note: 'First checkpoint.',
      work: fact({ evidence: [observation] }),
      idempotencyKey: randomUUID(),
    },
    source,
  );
  const persisted = (await work.snapshot()).events.find((event) => event.id === first.event.id)
    ?.work?.evidence[0];
  assert.deepEqual(persisted, observation);
  const second = await work.record(
    {
      taskId: task.id,
      kind: 'work_recorded',
      note: 'New checkpoint reuses the same observation.',
      work: fact({
        summary: 'Confirmed the review result.',
        evidence: [
          {
            day: observation.day,
            summary: observation.summary,
            kind: observation.kind,
            id: observation.id,
          },
        ],
      }),
      idempotencyKey: randomUUID(),
    },
    { ...source, agent: 'another-agent' },
  );
  assert.notEqual(second.event.id, first.event.id);
  assert.deepEqual(second.event.work?.evidence[0], observation);
  const beforeConflict = await work.snapshot();
  await assert.rejects(
    work.record(
      {
        taskId: task.id,
        kind: 'work_recorded',
        note: 'Attempt to change the observation day.',
        work: fact({ evidence: [{ ...observation, day: '2026-11-21' }] }),
        idempotencyKey: randomUUID(),
      },
      source,
    ),
    (error) => error instanceof Error && 'status' in error && error.status === 409,
  );
  assert.deepEqual(await work.snapshot(), beforeConflict);
  assert.equal(beforeConflict.events.length, 3);
});

test('evidence with optional source and timestamp survives rereading but optional changes are conflicts', async (t) => {
  const { work, task } = await fixture(t);
  const observation = {
    id: 'timestamped-observation',
    kind: 'human_message',
    summary: 'The user reports the validation.',
    sourceId: 'original-message-42',
    occurredAt: '2026-11-20T10:00:00-03:00',
  } as const;
  const first = await work.record(
    {
      taskId: task.id,
      kind: 'work_recorded',
      note: 'First checkpoint with a timestamped source.',
      work: fact({ evidence: [observation] }),
      idempotencyKey: randomUUID(),
    },
    source,
  );
  const reread = (await work.snapshot()).events.find((event) => event.id === first.event.id)?.work
    ?.evidence[0];
  assert.deepEqual(reread, observation);
  const second = await work.record(
    {
      taskId: task.id,
      kind: 'work_recorded',
      note: 'Second checkpoint preserves the optional fields and content.',
      work: fact({
        summary: 'Recorded the validation confirmation.',
        evidence: [
          {
            occurredAt: observation.occurredAt,
            sourceId: observation.sourceId,
            summary: observation.summary,
            kind: observation.kind,
            id: observation.id,
          },
        ],
      }),
      idempotencyKey: randomUUID(),
    },
    { ...source, agent: 'another-agent' },
  );
  assert.deepEqual(second.event.work?.evidence[0], observation);
  const beforeConflicts = await work.snapshot();
  for (const changed of [
    { ...observation, sourceId: 'different-message' },
    { ...observation, occurredAt: '2026-11-20T10:01:00-03:00' },
    { ...observation, sourceId: undefined },
    { ...observation, occurredAt: undefined },
  ])
    await assert.rejects(
      work.record(
        {
          taskId: task.id,
          kind: 'work_recorded',
          note: 'Attempt to modify an optional field.',
          work: fact({ evidence: [changed] }),
          idempotencyKey: randomUUID(),
        },
        source,
      ),
      (error) => error instanceof Error && 'status' in error && error.status === 409,
    );
  assert.deepEqual(await work.snapshot(), beforeConflicts);
  assert.equal(beforeConflicts.events.length, 3);
});
