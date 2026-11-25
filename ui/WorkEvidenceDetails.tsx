import { ArrowUpRight } from 'lucide-react';
import type { WorkEvidence, WorkEpisode } from '../src/domain/work-evidence';
import type { WorkEvent } from './api';
import { evidenceLabel, phaseLabel, formatDay } from './workLabels';

const formatInstant = (value: string, timezone: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value));

export function WorkEvidenceDetails({
  evidence,
  episode,
  event,
  timezone,
}: {
  evidence: WorkEvidence[];
  episode?: WorkEpisode;
  event?: WorkEvent;
  timezone: string;
}) {
  return (
    <details className="group text-sm">
      <summary className="cursor-pointer text-primary text-xs font-medium py-1">
        {evidence.length ? `Ver evidências (${evidence.length})` : 'Ver registro de origem'}
      </summary>
      <div className="mt-3 space-y-4 border-l-2 border-base-300 pl-4">
        {evidence.length ? (
          <ul className="space-y-4">
            {evidence.map((item) => (
              <li key={item.id} className="space-y-1">
                <p className="text-xs font-medium text-base-content/60">
                  {evidenceLabel[item.kind]}
                </p>
                <p className="whitespace-pre-wrap break-words leading-relaxed">{item.summary}</p>
                <p className="text-xs text-base-content/60">
                  {item.occurredAt
                    ? formatInstant(item.occurredAt, timezone)
                    : item.day
                      ? `${formatDay(item.day)} · horário não informado`
                      : 'Horário original não informado'}
                </p>
                {item.sourceId && (
                  <p className="text-xs text-base-content/60 break-all">Fonte: {item.sourceId}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="text-xs text-base-content/60">
              Registro anterior sem evidências estruturadas.
            </p>
            {event && <p className="whitespace-pre-wrap break-words">{event.note}</p>}
          </>
        )}
        {episode && (
          <div className="space-y-1">
            <p className="text-xs font-medium">Episódio: {phaseLabel[episode.phase]}</p>
            {episode.window && (
              <>
                <p className="text-xs text-base-content/60">
                  Janela observada: {formatInstant(episode.window.startedAt, timezone)} até{' '}
                  {formatInstant(episode.window.endedAt, timezone)}
                </p>
                <p className="text-xs text-base-content/60">
                  A janela da conversa não representa duração humana medida.
                </p>
              </>
            )}
          </div>
        )}
        {event && (
          <p className="text-xs text-base-content/60">
            Registrado por {event.source.agent} em {formatInstant(event.recordedAt, timezone)}.
          </p>
        )}
        {event?.references?.map((reference) => (
          <a
            key={reference.url}
            href={reference.url}
            target="_blank"
            rel="noopener noreferrer"
            className="link link-primary inline-flex gap-1 items-center mr-3 break-words"
          >
            {reference.label}
            <ArrowUpRight size={12} className="shrink-0" />
          </a>
        ))}
        <details className="text-xs text-base-content/60">
          <summary className="cursor-pointer">Identificadores do registro</summary>
          <dl className="space-y-2 mt-2 break-all">
            {event && (
              <div>
                <dt className="font-medium">Evento</dt>
                <dd>{event.id}</dd>
              </div>
            )}
            {evidence.map((item) => (
              <div key={item.id}>
                <dt className="font-medium">Evidência</dt>
                <dd>{item.id}</dd>
              </div>
            ))}
            {episode && (
              <div>
                <dt className="font-medium">Episódio</dt>
                <dd>{episode.id}</dd>
              </div>
            )}
            {event?.source.chatUrl && (
              <div>
                <dt className="font-medium">Chat de origem</dt>
                <dd>{event.source.chatUrl}</dd>
              </div>
            )}
          </dl>
        </details>
      </div>
    </details>
  );
}
