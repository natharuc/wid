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
  if (work.day > today)
    throw new WorkError('Use o dia em que o trabalho ocorreu; não uma realização futura.');
  if (occurredAt && localDay(occurredAt, timezone) !== work.day)
    throw new WorkError('O dia factual deve corresponder ao horário original informado.');
  const known = new Map(
    previous.flatMap((event) => event.work?.evidence ?? []).map((item) => [item.id, item]),
  );
  for (const item of work.evidence) {
    if (item.day && item.day > today)
      throw new WorkError('A evidência deve ter um dia já ocorrido.');
    if (item.occurredAt && Date.parse(item.occurredAt) > Date.parse(now) + 300_000)
      throw new WorkError('A evidência deve ter um horário já ocorrido.');
    const original = known.get(item.id);
    if (
      original &&
      !(['id', 'kind', 'summary', 'sourceId', 'occurredAt', 'day'] as const).every(
        (field) => original[field] === item[field],
      )
    )
      throw new WorkError(
        'ID de evidência já usado com conteúdo diferente. Preserve o original e use outro ID para a nova observação.',
        409,
      );
  }
  if (work.episode?.window && Date.parse(work.episode.window.endedAt) > Date.parse(now) + 300_000)
    throw new WorkError('A janela observada do episódio não pode estar no futuro.');
}
