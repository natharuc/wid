import { WorkError, type WorkEvent } from '../domain/work.js';
import type { StructuredWork } from '../domain/work-evidence.js';
import { localDay } from '../domain/time.js';

export function validateWorkEvidence(
  work: StructuredWork | undefined,
  previous: WorkEvent[],
  now: string,
  timezone: string,
  occurredAt?: string,
): void {
  if (!work) return;
  const today = localDay(now, timezone);
  if (work.day > today) throw new WorkError('Use the day the work occurred, not a future result.');
  if (occurredAt && localDay(occurredAt, timezone) !== work.day)
    throw new WorkError('The factual day must match the supplied original timestamp.');
  const known = new Map(
    previous.flatMap((event) => event.work?.evidence ?? []).map((item) => [item.id, item]),
  );
  for (const item of work.evidence) {
    if (item.day && item.day > today)
      throw new WorkError('Evidence must have a past or current day.');
    if (item.occurredAt && Date.parse(item.occurredAt) > Date.parse(now) + 300_000)
      throw new WorkError('Evidence must have a past timestamp.');
    const original = known.get(item.id);
    if (
      original &&
      !(['id', 'kind', 'summary', 'sourceId', 'occurredAt', 'day'] as const).every(
        (field) => original[field] === item[field],
      )
    )
      throw new WorkError(
        'Evidence ID already used with different content. Preserve the original and use another ID for the new observation.',
        409,
      );
  }
  if (work.episode?.window && Date.parse(work.episode.window.endedAt) > Date.parse(now) + 300_000)
    throw new WorkError('The observed episode window cannot be in the future.');
}
