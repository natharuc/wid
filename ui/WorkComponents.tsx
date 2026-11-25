import { ArrowUpRight } from 'lucide-react';
import { hours, kindLabel, statusLabel, type Task, type WorkEvent } from './api';
import { taskPath } from './navigation';
import { useWorkContext } from './WorkContext';
import { WorkEvidenceDetails } from './WorkEvidenceDetails';
const stateClasses: Record<Task['status'], string> = {
  planned: 'badge-ghost',
  active: 'badge-info',
  blocked: 'badge-warning',
  completed: 'badge-success',
  cancelled: 'badge-ghost',
};
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
    <div className="stat min-w-0 py-5 px-5">
      <div className="stat-title text-xs">{label}</div>
      <div className={`stat-value text-3xl tabular-nums ${accent ? 'text-primary' : ''}`}>
        {value}
      </div>
      <div className="stat-desc mt-2 text-xs whitespace-normal">{description}</div>
    </div>
  );
}
export function TaskRow({
  task,
  time,
  showTime,
}: {
  task: Task;
  time?: number;
  showTime: boolean;
}) {
  const { href } = useWorkContext();
  return (
    <tr className="hover:bg-base-200/50">
      <td className="min-w-40">
        <a className="link link-hover text-left font-medium" href={href(taskPath(task.id))}>
          {task.title}
        </a>
        <p className="text-xs text-base-content/60 mt-1">
          {[task.company, task.project].filter(Boolean).join(' / ') || 'No project'}
        </p>
      </td>
      <td>
        <span
          className={`badge badge-soft badge-sm whitespace-nowrap ${stateClasses[task.status]}`}
        >
          {statusLabel[task.status]}
        </span>
      </td>
      {showTime && (
        <td className="text-right tabular-nums whitespace-nowrap">
          {time === undefined ? '—' : hours(time)}
        </td>
      )}
    </tr>
  );
}
export function TimelineEvent({
  event,
  task,
  timezone,
}: {
  event: WorkEvent;
  task?: Task;
  timezone: string;
}) {
  const { href } = useWorkContext();
  const confidence =
    event.effort?.confidence &&
    { low: 'low', medium: 'medium', high: 'high' }[event.effort.confidence];
  const category =
    event.effort &&
    {
      human_estimated: `estimated · confidence ${confidence}`,
      human_measured: 'measured human time',
      agent_run: 'agent runtime',
      wait: 'waiting',
    }[event.effort.category];
  return (
    <article className="collapse collapse-arrow border border-base-300 rounded-box bg-base-100">
      <input
        type="checkbox"
        aria-label={`Details: ${kindLabel[event.kind]} in ${task?.title ?? 'task'}`}
      />
      <div className="collapse-title p-4 pr-10">
        <div className="flex items-center justify-between gap-2 text-xs text-base-content/60 mb-1">
          <time>
            {new Intl.DateTimeFormat('en', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: timezone,
            }).format(new Date(event.occurredAt))}
          </time>
          <span>{event.source.agent}</span>
        </div>
        <h3 className="font-medium text-sm">{kindLabel[event.kind]}</h3>
        <p className="text-xs text-base-content/60 mt-1 truncate">{task?.title}</p>
        {event.effort && (
          <p className="text-xs text-primary font-medium mt-2">
            {hours(event.effort.minutes)} · {category}
          </p>
        )}
      </div>
      <div className="collapse-content text-sm space-y-3">
        <p className="whitespace-pre-wrap break-words">{event.note}</p>
        {event.kind === 'context_changed' && (
          <p className="text-xs text-base-content/60">
            {event.previousContext} → {event.context}
          </p>
        )}
        {event.work && (
          <WorkEvidenceDetails
            evidence={event.work.evidence}
            episode={event.work.episode}
            event={event}
            timezone={timezone}
          />
        )}
        <a className="btn btn-ghost btn-xs" href={href(taskPath(event.taskId))}>
          Open task
          <ArrowUpRight size={13} />
        </a>
        <dl className="text-xs text-base-content/60 space-y-2 break-all">
          <div>
            <dt className="font-medium">ID</dt>
            <dd>{event.id}</dd>
          </div>
          <div>
            <dt className="font-medium">Occurred / recorded</dt>
            <dd>
              {event.occurredAt}
              <br />
              {event.recordedAt}
            </dd>
          </div>
          {event.source.sessionId && (
            <div>
              <dt className="font-medium">Session</dt>
              <dd>{event.source.sessionId}</dd>
            </div>
          )}
          {event.source.chatUrl && (
            <div>
              <dt className="font-medium">Chat</dt>
              <dd>{event.source.chatUrl}</dd>
            </div>
          )}
        </dl>
        {[
          ...new Map(
            [...(task?.references ?? []), ...(event.references ?? [])].map((ref) => [ref.url, ref]),
          ).values(),
        ].map((ref) => (
          <a
            key={ref.url}
            href={ref.url}
            target="_blank"
            rel="noreferrer"
            className="link link-primary text-xs flex gap-1 items-center"
          >
            {ref.label}
            <ArrowUpRight size={12} />
          </a>
        ))}
      </div>
    </article>
  );
}
