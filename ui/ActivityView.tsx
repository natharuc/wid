import { useState } from 'react';
import { History, ListTodo, Plus, Search } from 'lucide-react';
import { localDay } from '../src/domain/time';
import { statusLabel, type DayReport, type Snapshot, type Task } from './api';
import { TaskRow, TimelineEvent } from './WorkComponents';
export function ActivityView({
  page,
  day,
  snapshot,
  daily,
  timezone,
  onSelect,
  onNew,
}: {
  page: 'day' | 'tasks';
  day: string;
  snapshot: Snapshot;
  daily?: DayReport;
  timezone: string;
  onSelect: (task: Task) => void;
  onNew: () => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const events = snapshot.events.filter(
    (event) => (event.effort?.day ?? localDay(event.occurredAt, timezone)) === day,
  );
  const ids = new Set(events.map((event) => event.taskId));
  const tasks = snapshot.tasks.filter(
    (task) =>
      (page !== 'day' || ids.has(task.id)) &&
      (status === 'all' || task.status === status) &&
      `${task.title} ${task.company} ${task.project}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <section
        className={`card bg-base-100 border border-base-300 ${page === 'day' ? 'xl:col-span-2' : 'xl:col-span-3'}`}
      >
        <div className="card-body gap-5 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="card-title text-base">
              {page === 'day' ? 'Atividades do dia' : 'Tarefas registradas'}
            </h2>
            <span className="badge badge-ghost badge-sm">{tasks.length}</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="input w-full">
              <Search size={16} />
              <input
                placeholder="Buscar tarefa ou projeto"
                aria-label="Buscar tarefas"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <select
              className="select w-full sm:w-auto"
              aria-label="Filtrar por status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">Todos os estados</option>
              {Object.entries(statusLabel).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {tasks.length ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tarefa</th>
                    <th>Estado</th>
                    {page === 'day' && <th className="text-right">Horas</th>}
                    <th>
                      <span className="sr-only">Atualizar</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      time={daily?.taskMinutes[task.id]?.humanMinutes}
                      showTime={page === 'day'}
                      onSelect={() => onSelect(task)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <ListTodo size={28} className="text-base-content/40" />
              <h3 className="font-medium">
                {query || status !== 'all'
                  ? 'Nenhuma tarefa neste filtro'
                  : 'Nenhuma atividade registrada'}
              </h3>
              <p className="text-sm text-base-content/60">
                {query || status !== 'all'
                  ? 'Ajuste a busca ou o estado selecionado.'
                  : 'Sem registros, o tempo trabalhado é desconhecido.'}
              </p>
              <button className="btn btn-outline btn-sm mt-2" onClick={onNew}>
                <Plus size={16} />
                Criar tarefa
              </button>
            </div>
          )}
        </div>
      </section>
      {page === 'day' && (
        <aside className="card border border-base-300 bg-base-100">
          <div className="card-body p-4 sm:p-6">
            <h2 className="card-title text-base mb-3">
              <History size={18} />
              Histórico do dia
            </h2>
            {events.length ? (
              <div className="space-y-3">
                {[...events].reverse().map((event) => {
                  const task = snapshot.tasks.find((task) => task.id === event.taskId);
                  return (
                    <TimelineEvent
                      key={event.id}
                      event={event}
                      task={task}
                      timezone={timezone}
                      onSelect={() => task && onSelect(task)}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-base-content/60 py-5">Nenhum evento registrado.</p>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
