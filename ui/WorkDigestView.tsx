import { ArrowUpRight } from 'lucide-react';
import type { WorkDigest, WorkDigestItem } from '../src/domain/work-digest';
import type { WorkEvent } from './api';
import { taskPath } from './navigation';
import { useWorkContext } from './WorkContext';
import { WorkEvidenceDetails } from './WorkEvidenceDetails';
import { actorLabel, outcomeClass, outcomeLabel } from './workLabels';

export function WorkDigestView({
  digest,
  events,
  timezone,
  title = 'O que você fez',
  showTaskLinks = true,
}: {
  digest: WorkDigest;
  events: WorkEvent[];
  timezone: string;
  title?: string;
  showTaskLinks?: boolean;
}) {
  const completed = digest.items
    .map((item) => ({
      ...item,
      facts: item.facts.filter((fact) => fact.outcome !== 'planned' && fact.outcome !== 'recorded'),
    }))
    .filter((item) => item.facts.length);
  const planned = digest.items
    .map((item) => ({ ...item, facts: item.facts.filter((fact) => fact.outcome === 'planned') }))
    .filter((item) => item.facts.length);
  const recorded = digest.items
    .filter(
      (item) =>
        !item.facts.some((fact) => fact.outcome !== 'planned' && fact.outcome !== 'recorded'),
    )
    .map((item) => ({ ...item, facts: item.facts.filter((fact) => fact.outcome === 'recorded') }))
    .filter((item) => item.facts.length);
  const draw = (items: WorkDigestItem[]) => {
    const cards = (subset: WorkDigestItem[]) =>
      subset.map((item) => (
        <DigestItem
          key={item.taskId}
          item={item}
          events={events}
          timezone={timezone}
          showTaskLinks={showTaskLinks}
        />
      ));
    return (
      <>
        {cards(items.slice(0, 5))}
        {items.length > 5 && (
          <details className="space-y-3">
            <summary className="cursor-pointer text-sm text-primary">
              Ver mais {items.length - 5} tarefas
            </summary>
            <div className="space-y-4 mt-4">{cards(items.slice(5))}</div>
          </details>
        )}
      </>
    );
  };
  return (
    <section className="space-y-4" aria-label={title}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="badge badge-ghost badge-sm">{completed.length}</span>
      </div>
      {completed.length ? (
        draw(completed)
      ) : (
        <div className="card bg-base-100 border border-base-300">
          <p className="card-body p-5 text-sm text-base-content/60">
            Nenhum resultado ou avanço registrado neste dia.
          </p>
        </div>
      )}
      {planned.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="font-medium text-sm text-base-content/60">Planejado</h3>
          {draw(planned)}
        </div>
      )}
      {recorded.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="font-medium text-sm text-base-content/60">Registros anteriores</h3>
          {draw(recorded)}
        </div>
      )}
      {digest.administrativeEvents > 0 && (
        <p className="text-xs text-base-content/60">
          {digest.administrativeEvents} atualizações administrativas disponíveis no histórico.
        </p>
      )}
    </section>
  );
}

function DigestItem({
  item,
  events,
  timezone,
  showTaskLinks,
}: {
  item: WorkDigestItem;
  events: WorkEvent[];
  timezone: string;
  showTaskLinks: boolean;
}) {
  const { href } = useWorkContext();
  return (
    <article className="card bg-base-100 border border-base-300">
      <div className="card-body p-5 sm:p-6 gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-base-content/60 break-words">{item.context}</p>
            <h3 className="font-semibold break-words">
              {showTaskLinks ? (
                <a className="link link-hover" href={href(taskPath(item.taskId))}>
                  {item.title}
                </a>
              ) : (
                item.title
              )}
            </h3>
          </div>
          {showTaskLinks && (
            <a
              className="btn btn-ghost btn-sm btn-square shrink-0"
              href={href(taskPath(item.taskId))}
              aria-label={`Abrir tarefa: ${item.title}`}
            >
              <ArrowUpRight size={17} />
            </a>
          )}
        </div>
        <ul className="space-y-5">
          {item.facts.map((fact) => (
            <li key={fact.eventId} className="space-y-2">
              <div className="flex flex-wrap gap-2 items-center text-xs">
                <span className={`badge badge-soft badge-sm ${outcomeClass[fact.outcome]}`}>
                  {outcomeLabel[fact.outcome]}
                </span>
                <span className="text-base-content/60">{actorLabel[fact.actor]}</span>
                {!fact.structured && fact.outcome !== 'recorded' && (
                  <span className="text-base-content/50">Registro anterior</span>
                )}
              </div>
              <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                {fact.summary}
              </p>
              <WorkEvidenceDetails
                evidence={fact.evidence}
                episode={fact.episode}
                event={events.find((event) => event.id === fact.eventId)}
                timezone={timezone}
              />
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
