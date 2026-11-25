import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  LayoutList,
  ListTodo,
  Plus,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import { localDay } from '../src/domain/time';
import {
  api,
  hours,
  kindLabel,
  statusLabel,
  type Agent,
  type DayReport,
  type MonthReport,
  type Settings,
  type Snapshot,
  type Task,
  type WorkEvent,
} from './api';
import { WorkDialog } from './WorkDialog';
import { MonthView } from './MonthView';
import { DayOverview } from './DayOverview';
import { TaskRow, TimelineEvent } from './WorkComponents';
import { AgentsView, SettingsView } from './SettingsView';

type Page = 'day' | 'tasks' | 'month' | 'agents' | 'settings';
const nav = [
  { id: 'day', label: 'Visão diária', icon: LayoutList },
  { id: 'tasks', label: 'Tarefas', icon: ListTodo },
  { id: 'month', label: 'Relatório mensal', icon: CalendarDays },
  { id: 'agents', label: 'Agentes', icon: Bot },
  { id: 'settings', label: 'Configurações', icon: Settings2 },
] as const;
export function App() {
  const [page, setPage] = useState<Page>('day');
  const [snapshot, setSnapshot] = useState<Snapshot>({ tasks: [], events: [] });
  const [settings, setSettings] = useState<Settings>();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [day, setDay] = useState(localDay(new Date().toISOString()));
  const [month, setMonth] = useState(day.slice(0, 7));
  const [daily, setDaily] = useState<DayReport>();
  const [monthly, setMonthly] = useState<MonthReport>();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [dialog, setDialog] = useState<Task | 'new' | null>(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    const [data, config, clients, dayData, monthData] = await Promise.all([
      api<Snapshot>('snapshot'),
      api<Settings>('settings'),
      api<Agent[]>('agents'),
      api<DayReport>(`day/${day}`),
      api<MonthReport>(`month/${month}`),
    ]);
    setSnapshot(data);
    setSettings(config);
    setAgents(clients);
    setDaily(dayData);
    setMonthly(monthData);
    setLoading(false);
  }, [day, month]);
  useEffect(() => {
    void reload().catch((error) => {
      setNotice(error.message);
      setLoading(false);
    });
    const timer = setInterval(() => {
      void reload().catch(() => {});
    }, 15_000);
    return () => clearInterval(timer);
  }, [reload]);
  const timezone = settings?.timezone ?? 'America/Sao_Paulo';
  const dailyEvents = snapshot.events.filter(
    (event) => (event.effort?.day ?? localDay(event.occurredAt, timezone)) === day,
  );
  const dailyIds = new Set(dailyEvents.map((event) => event.taskId));
  const filtered = snapshot.tasks.filter(
    (task) =>
      (page !== 'day' || dailyIds.has(task.id)) &&
      (status === 'all' || task.status === status) &&
      `${task.title} ${task.company} ${task.project}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const chooseDay = (value: string) => {
    setDay(value);
    setPage('day');
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="WID início">
          wid<span className="brand-dot">.</span>
        </a>
        <span className="brand-sub">what I did?</span>
        <div className="sidebar-label">REGISTRO DE TRABALHO</div>
        <nav>
          {nav.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={page === item.id ? 'nav-item selected' : 'nav-item'}
            >
              <item.icon size={18} />
              {item.label}
              {item.id === 'tasks' && <span className="nav-count">{snapshot.tasks.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-status">
            <span />
            Servidor local
          </div>
          <span className="mono">v0.1.0 · PostgreSQL</span>
          <a href="https://github.com/natharuc/wid" target="_blank" rel="noreferrer">
            Repositório
            <ArrowUpRight size={13} />
          </a>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Meu trabalho<span>/</span>
            <strong>{nav.find((item) => item.id === page)?.label}</strong>
          </div>
          <div className="top-right">
            <span className="mono timezone">{timezone}</span>
            <span className="avatar">EU</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === 'day' ? 'REGISTROS DO DIA' : 'WID / REGISTRO LOCAL'}
              </div>
              <h1>
                {
                  {
                    day: 'O que eu fiz?',
                    tasks: 'Minhas tarefas',
                    month: 'Quanto eu trabalhei?',
                    agents: 'Agentes conectados',
                    settings: 'Configurações',
                  }[page]
                }
              </h1>
            </div>
            <button className="primary" onClick={() => setDialog('new')}>
              <Plus size={17} />
              Nova tarefa
            </button>
          </div>
          {notice && (
            <div className="toast" role="status">
              <span>{notice}</span>
              <button
                className="icon-btn"
                aria-label="Dispensar aviso"
                onClick={() => setNotice('')}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <p className="muted" role="status">
              Carregando registros…
            </p>
          ) : (
            <>
              {page === 'day' && (
                <DayOverview daily={daily} day={day} setDay={setDay} timezone={timezone} />
              )}
              {(page === 'day' || page === 'tasks') && (
                <div className={page === 'day' ? 'daily-layout' : ''}>
                  <section className="task-section">
                    <div className="section-title">
                      <h2>{page === 'day' ? 'Atividades do dia' : 'Tarefas registradas'}</h2>
                      <span className="count">{filtered.length}</span>
                    </div>
                    <div className="table-tools">
                      <label className="search">
                        <Search size={16} />
                        <input
                          placeholder="Buscar tarefa ou projeto"
                          aria-label="Buscar tarefas"
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                        />
                      </label>
                      <select
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
                    <div className="task-list">
                      {filtered.length ? (
                        filtered.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            time={
                              page === 'day' ? daily?.taskMinutes[task.id]?.humanMinutes : undefined
                            }
                            onSelect={() => setDialog(task)}
                          />
                        ))
                      ) : (
                        <div className="empty-state">
                          <ListTodo size={30} />
                          <h3>
                            {query || status !== 'all'
                              ? 'Nenhuma tarefa neste filtro'
                              : page === 'day'
                                ? 'Nenhuma atividade registrada'
                                : 'Crie sua primeira tarefa'}
                          </h3>
                          <p>
                            {page === 'day'
                              ? 'Sem registros, o tempo trabalhado é desconhecido.'
                              : 'Registre uma intenção para começar o histórico.'}
                          </p>
                          <button className="text-btn" onClick={() => setDialog('new')}>
                            Criar tarefa
                            <ArrowRight size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </section>
                  {page === 'day' && (
                    <aside className="timeline-section">
                      <div className="section-title">
                        <h2>Linha do tempo</h2>
                        <Activity size={17} />
                      </div>
                      <div className="timeline">
                        {dailyEvents.length ? (
                          [...dailyEvents]
                            .reverse()
                            .map((event) => (
                              <TimelineEvent
                                key={event.id}
                                event={event}
                                task={snapshot.tasks.find((task) => task.id === event.taskId)}
                                timezone={timezone}
                                onSelect={() =>
                                  setDialog(
                                    snapshot.tasks.find((task) => task.id === event.taskId) ?? null,
                                  )
                                }
                              />
                            ))
                        ) : (
                          <p className="muted timeline-empty">
                            Os próximos registros deste dia aparecerão aqui.
                          </p>
                        )}
                      </div>
                    </aside>
                  )}
                </div>
              )}
              {page === 'month' && monthly && (
                <MonthView
                  monthly={monthly}
                  month={month}
                  setMonth={setMonth}
                  chooseDay={chooseDay}
                />
              )}
              {page === 'agents' && (
                <AgentsView agents={agents} reload={reload} reportError={setNotice} />
              )}
              {page === 'settings' && settings && (
                <SettingsView settings={settings} onSaved={reload} />
              )}
            </>
          )}
          <footer>
            <span>
              <Circle size={9} />
              Dados neste computador
            </span>
            <span>Sem registro ≠ sem trabalho</span>
          </footer>
        </main>
      </div>
      {dialog && (
        <WorkDialog
          task={dialog === 'new' ? undefined : dialog}
          day={day}
          onClose={() => setDialog(null)}
          onSaved={() => {
            void reload().catch((error) => setNotice(error.message));
          }}
        />
      )}
    </div>
  );
}
