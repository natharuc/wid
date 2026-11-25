import { History } from 'lucide-react';
import { hours, kindLabel, type WorkEvent } from './api';
import { WorkEvidenceDetails } from './WorkEvidenceDetails';
import { actorLabel, formatDay, outcomeLabel } from './workLabels';

export const formatDate = (value: string, timezone: string) =>
  new Intl.DateTimeFormat('en', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value));

export function TaskHistory({ events, timezone }: { events: WorkEvent[]; timezone: string }) {
  const corrected = new Set(
    events.flatMap((event) => (event.correctsEventId ? [event.correctsEventId] : [])),
  );
  return (
    <section className="card bg-base-100 border border-base-300">
      <div className="card-body p-5 sm:p-6 gap-5">
        <h2 className="card-title text-base">
          <History size={18} />
          History<span className="badge badge-ghost badge-sm">{events.length}</span>
        </h2>
        {[...events].reverse().map((event) => (
          <article key={event.id} className="border-l-2 border-base-300 pl-4 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="font-semibold text-sm">{kindLabel[event.kind]}</h3>
              <time
                dateTime={event.work?.day ?? event.occurredAt}
                className="text-xs text-base-content/60"
              >
                {event.work ? formatDay(event.work.day) : formatDate(event.occurredAt, timezone)}
              </time>
              {corrected.has(event.id) && (
                <span className="badge badge-ghost badge-xs">Corrected</span>
              )}
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{event.note}</p>
            {event.work && (
              <div className="space-y-2">
                <p className="text-xs text-base-content/60">
                  {outcomeLabel[event.work.outcome]} · {actorLabel[event.work.actor]}
                </p>
                {event.work.summary !== event.note && (
                  <p className="text-sm break-words">{event.work.summary}</p>
                )}
                <WorkEvidenceDetails
                  evidence={event.work.evidence}
                  episode={event.work.episode}
                  event={event}
                  timezone={timezone}
                />
              </div>
            )}
            {event.effort && (
              <p className="text-xs font-medium text-primary">
                {hours(event.effort.minutes)} ·{' '}
                {
                  {
                    human_estimated: 'Human estimate',
                    human_measured: 'Measured human time',
                    agent_run: 'Agent runtime',
                    wait: 'Waiting',
                  }[event.effort.category]
                }{' '}
                · {formatDay(event.effort.day)}
                {event.effort.confidence &&
                  ` · confidence ${{ low: 'low', medium: 'medium', high: 'high' }[event.effort.confidence]}`}
              </p>
            )}
            {event.kind === 'context_changed' && (
              <p className="text-xs text-base-content/60">
                {event.previousContext} → {event.context}
              </p>
            )}
            {!event.work &&
              event.references?.map((ref) => (
                <a
                  key={ref.url}
                  className="link link-primary text-xs block"
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {ref.label}
                </a>
              ))}
            <details className="text-xs text-base-content/60">
              <summary className="cursor-pointer">Source: {event.source.agent}</summary>
              <dl className="mt-2 space-y-1 break-all">
                <div>
                  <dt className="font-medium">Record ID</dt>
                  <dd>{event.id}</dd>
                </div>
                <div>
                  <dt className="font-medium">Recorded at</dt>
                  <dd>{formatDate(event.recordedAt, timezone)}</dd>
                </div>
                {event.correctsEventId && (
                  <div>
                    <dt className="font-medium">Corrects record</dt>
                    <dd>{event.correctsEventId}</dd>
                  </div>
                )}
                {event.source.chatUrl && (
                  <div>
                    <dt className="font-medium">Source chat</dt>
                    <dd>{event.source.chatUrl}</dd>
                  </div>
                )}
              </dl>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
