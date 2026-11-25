import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { api, statusLabel } from './api';
import type { TaskReport } from '../src/domain/task-report';
import { ReferenceLinks } from './ReferenceLinks';
import { TaskHistory, formatDate } from './TaskHistory';
import { TaskTimeSummary, TaskDayHours } from './TaskTime';
import { useWorkContext } from './WorkContext';
import { contextQuery } from './context-scope';
import { WorkDigestView } from './WorkDigestView';
import { formatDay } from './workLabels';

export function TaskDetailPage({ taskId }: { taskId: string }) {
  const { context, href } = useWorkContext();
  const [data, setData] = useState<TaskReport>();
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    try {
      setData(await api<TaskReport>(`tasks/${encodeURIComponent(taskId)}${contextQuery(context)}`));
      setError('');
    } catch (err) {
      setData(undefined);
      document.title = 'Tarefa indisponível — WID';
      setError((err as Error).message);
    }
  }, [taskId, context]);
  useEffect(() => {
    void reload();
    const timer = setInterval(() => {
      void reload();
    }, 15_000);
    return () => clearInterval(timer);
  }, [reload]);
  useEffect(() => {
    if (data) document.title = `${data.task.title} — WID`;
  }, [data?.task.title]);
  if (!data)
    return (
      <div className="space-y-4">
        <a href={href('/tasks')} className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} />
          Tarefas
        </a>
        {error ? (
          <p role="alert" className="alert alert-error alert-soft">
            {error}
          </p>
        ) : (
          <p role="status">Carregando tarefa…</p>
        )}
      </div>
    );
  const { task, events, timezone } = data;
  const intention = events.find((event) => event.kind === 'planned')?.note;
  const digest =
    data.digest.find((day) =>
      day.items.some((item) => item.facts.some((fact) => fact.outcome !== 'planned')),
    ) ?? data.digest.find((day) => day.items.length > 0);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <a href={href('/tasks')} className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} />
          Tarefas
        </a>
        <button className="btn btn-ghost btn-sm" onClick={() => void reload()}>
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>
      {error && (
        <p role="alert" className="alert alert-warning alert-soft">
          {error}
        </p>
      )}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-outline">{task.context}</span>
          <span className="badge badge-soft">{statusLabel[task.status]}</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-semibold break-words">{task.title}</h2>
        <p className="text-sm text-base-content/60">
          {[task.company, task.project].filter(Boolean).join(' / ') || 'Sem projeto'}
        </p>
        <p className="text-xs text-base-content/60">
          Criada em {formatDate(task.createdAt, timezone)} · Atualizada em{' '}
          {formatDate(task.updatedAt, timezone)}
        </p>
      </section>
      {digest && (
        <div className="space-y-2">
          <p className="text-xs text-base-content/60">Resumo de {formatDay(digest.day)}</p>
          <WorkDigestView
            digest={digest}
            events={events}
            timezone={timezone}
            title="Resultado e andamento"
            showTaskLinks={false}
          />
        </div>
      )}
      <TaskTimeSummary data={data} />
      <p className="text-xs text-base-content/60">
        Cobertura parcial. Dias sem registros têm tempo desconhecido.
      </p>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 order-2 xl:order-1">
          <details className="collapse collapse-arrow border border-base-300 bg-base-100">
            <summary className="collapse-title text-sm font-medium">
              Histórico completo ({events.length})
            </summary>
            <div className="collapse-content space-y-4">
              {intention && intention !== task.title && (
                <section className="space-y-2">
                  <h2 className="font-medium text-sm">Intenção inicial</h2>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {intention}
                  </p>
                </section>
              )}
              <TaskHistory events={events} timezone={timezone} />
            </div>
          </details>
        </div>
        <aside className="space-y-6 order-1 xl:order-2">
          <ReferenceLinks references={task.references} />
          <TaskDayHours data={data} />
        </aside>
      </div>
    </div>
  );
}
