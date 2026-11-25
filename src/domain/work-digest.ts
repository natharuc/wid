import type { Task, WorkEvent } from './work.js';
import type { StructuredWork } from './work-evidence.js';
import { localDay } from './time.js';

export interface DigestFact extends Omit<StructuredWork, 'day' | 'outcome'> {
  outcome: StructuredWork['outcome'] | 'recorded';
  eventId: string;
  structured: boolean;
  occurredAt: string;
  recordedAt: string;
}
export interface WorkDigestItem {
  taskId: string;
  title: string;
  context: string;
  facts: DigestFact[];
  evidenceCount: number;
}
export interface WorkDigest {
  day: string;
  items: WorkDigestItem[];
  administrativeEvents: number;
}
export const eventDay = (event: WorkEvent, timezone: string) =>
  event.effort?.day ?? event.work?.day ?? localDay(event.occurredAt, timezone);

export function effectiveFactEvents(events: WorkEvent[]): WorkEvent[] {
  const replaced = new Set(
    events
      .filter((event) => event.correctsEventId && (!event.effort || event.work))
      .map((event) => event.correctsEventId),
  );
  return events.filter((event) => !replaced.has(event.id));
}
const legacyOutcomes: Partial<Record<WorkEvent['kind'], DigestFact['outcome']>> = {
  planned: 'planned',
  started: 'recorded',
  progressed: 'advanced',
  decided: 'advanced',
  blocked: 'blocked',
  completed: 'delivered',
  cancelled: 'cancelled',
  historical_note: 'recorded',
  corrected: 'recorded',
};
function legacySummary(note: string): string {
  const first = note.trim().split(/\r?\n/).find(Boolean) ?? note;
  return first.length <= 280 ? first : `${first.slice(0, 277).trimEnd()}…`;
}
function digestFact(event: WorkEvent, originals: Map<string, WorkEvent>): DigestFact | undefined {
  if (event.work)
    return {
      ...event.work,
      eventId: event.id,
      structured: true,
      occurredAt: event.occurredAt,
      recordedAt: event.recordedAt,
    };
  const outcome = legacyOutcomes[event.kind];
  if (!outcome || (event.kind === 'corrected' && event.effort)) return undefined;
  if (event.kind === 'corrected') {
    const original = originals.get(event.correctsEventId ?? '');
    if (!original || (!original.work && !legacyOutcomes[original.kind])) return undefined;
  }
  return {
    eventId: event.id,
    summary: legacySummary(event.note),
    outcome,
    actor: 'unknown',
    evidence: [],
    structured: false,
    occurredAt: event.occurredAt,
    recordedAt: event.recordedAt,
  };
}
export function makeWorkDigest(
  tasks: Task[],
  events: WorkEvent[],
  day: string,
  timezone: string,
): WorkDigest {
  const relevant = effectiveFactEvents(events).filter((event) => eventDay(event, timezone) === day);
  const originals = new Map(events.map((event) => [event.id, event]));
  const items: WorkDigestItem[] = [];
  for (const task of tasks) {
    const facts = new Map<string, DigestFact>();
    for (const event of relevant.filter((event) => event.taskId === task.id)) {
      const fact = digestFact(event, originals);
      if (!fact) continue;
      const key = fact.episode
        ? `episode:${fact.episode.id}`
        : `fact:${fact.outcome}:${fact.summary.normalize('NFC').toLocaleLowerCase()}`;
      facts.delete(key);
      facts.set(key, fact);
    }
    // A creation intent is secondary once this task has an observed work fact on the day.
    const values = [...facts.values()];
    const hasWork = values.some((fact) => fact.outcome !== 'planned');
    const visible = values
      .filter((fact) => !hasWork || fact.outcome !== 'planned')
      .reverse()
      .slice(0, 3);
    if (visible.length)
      items.push({
        taskId: task.id,
        title: task.title,
        context: task.context,
        facts: visible,
        evidenceCount: new Set(visible.flatMap((fact) => fact.evidence.map((item) => item.id)))
          .size,
      });
  }
  return {
    day,
    items,
    administrativeEvents: relevant.filter((event) => !digestFact(event, originals)).length,
  };
}
