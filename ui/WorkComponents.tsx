import { ArrowUpRight, Check, Circle } from 'lucide-react';
import { hours, kindLabel, statusLabel, type Task, type WorkEvent } from './api';
export function Metric({
  label,
  value,
  description,
  accent,
}: {
  label: string;
  value: string;
  description: string;
  accent?: boolean;
}) {
  return (
    <div className={`metric ${accent ? 'accent-metric' : ''}`}>
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <span className="metric-description">{description}</span>
    </div>
  );
}
export function TaskRow({
  task,
  time,
  onSelect,
}: {
  task: Task;
  time?: number;
  onSelect: () => void;
}) {
  return (
    <button className="task-row" onClick={onSelect}>
      <span className={`task-icon ${task.status}`}>
        {task.status === 'completed' ? <Check size={17} /> : <Circle size={15} />}
      </span>
      <div className="task-info">
        <strong>{task.title}</strong>
        <span>
          {[task.company, task.project].filter(Boolean).join(' / ') || 'Sem empresa ou projeto'}
        </span>
      </div>
      <div className="task-meta">
        <span className={`badge ${task.status}`}>{statusLabel[task.status]}</span>
        <span className="mono">{time === undefined ? 'Registrar' : hours(time)}</span>
      </div>
      <ArrowUpRight className="row-arrow" size={16} />
    </button>
  );
}
export function TimelineEvent({
  event,
  task,
  timezone,
  onSelect,
}: {
  event: WorkEvent;
  task?: Task;
  timezone: string;
  onSelect: () => void;
}) {
  return (
    <article className="timeline-event">
      <div className={`timeline-dot ${event.kind}`} />
      <div className="event-time">
        <time>
          {new Intl.DateTimeFormat('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: timezone,
          }).format(new Date(event.occurredAt))}
        </time>
        <span>{event.source.agent}</span>
      </div>
      <button className="event-title" onClick={onSelect}>
        {kindLabel[event.kind]}
      </button>
      <p>{event.note}</p>
      <span className="event-task">{task?.title}</span>
      {event.effort && (
        <span className="effort-label">
          {hours(event.effort.minutes)} ·{' '}
          {event.effort.category === 'human_estimated'
            ? `estimativa ${{ low: 'baixa', medium: 'média', high: 'alta' }[event.effort.confidence!]}`
            : { human_measured: 'humano medido', agent_run: 'execução do agente', wait: 'espera' }[
                event.effort.category
              ]}{' '}
          · {event.effort.day}
        </span>
      )}
      <details>
        <summary>Origem e ID</summary>
        <code>{event.id}</code>
        <small>
          Ocorrido: {event.occurredAt}
          <br />
          Registrado: {event.recordedAt}
        </small>
        {event.source.sessionId && <small>Sessão: {event.source.sessionId}</small>}
        {event.source.chatUrl && <small>{event.source.chatUrl}</small>}
        {task?.references.map((ref) => (
          <a key={ref.url} href={ref.url} target="_blank" rel="noreferrer">
            {ref.label}
            <ArrowUpRight size={12} />
          </a>
        ))}
      </details>
    </article>
  );
}
