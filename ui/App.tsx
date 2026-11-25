import { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import { localDay } from '../src/domain/time';
import { type Task } from './api';
import { WorkDialog } from './WorkDialog';
import { MonthView } from './MonthView';
import { DayOverview } from './DayOverview';
import { ActivityView } from './ActivityView';
import { AgentsView, SettingsView } from './SettingsView';
import { Shell, type Page } from './Shell';
import { useDashboard } from './useDashboard';
import { ContextFilter } from './ContextControls';
import { contextKey, DEFAULT_CONTEXT } from '../src/domain/context';
export function App() {
  const [page, setPage] = useState<Page>('day');
  const [day, setDay] = useState(localDay(new Date().toISOString()));
  const [month, setMonth] = useState(day.slice(0, 7));
  const [dialog, setDialog] = useState<Task | 'new' | null>(null);
  const [context, setContext] = useState('');
  const {
    snapshot,
    settings,
    agents,
    contexts,
    daily,
    monthly,
    notice,
    setNotice,
    loading,
    reload,
  } = useDashboard(day, month, context);
  const activeContext =
    contexts.find((item) => contextKey(item.name) === context)?.name ?? DEFAULT_CONTEXT;
  useEffect(() => {
    if (!loading && context && !contexts.some((item) => contextKey(item.name) === context)) {
      setContext('');
    }
  }, [context, contexts, loading]);
  const timezone = settings?.timezone ?? 'America/Sao_Paulo';
  const chooseDay = (day: string) => {
    setDay(day);
    setPage('day');
  };
  return (
    <>
      <Shell
        page={page}
        setPage={setPage}
        taskCount={snapshot.tasks.length}
        timezone={timezone}
        newTask={() => setDialog('new')}
      >
        {['day', 'tasks', 'month'].includes(page) && (
          <div className="flex flex-wrap items-center gap-3">
            <ContextFilter contexts={contexts} value={context} onChange={setContext} />
            <span className="text-xs text-base-content/60">Tarefas e horas por contexto</span>
          </div>
        )}
        {notice && (
          <div className="alert alert-soft alert-info" role="status">
            <Info size={20} />
            <span>{notice}</span>
            <button
              className="btn btn-ghost btn-sm btn-square"
              aria-label="Dispensar aviso"
              onClick={() => setNotice('')}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex items-center gap-3 py-16" role="status">
            <span className="loading loading-spinner loading-sm" />
            Carregando registros…
          </div>
        ) : (
          <>
            {page === 'day' && (
              <DayOverview daily={daily} day={day} setDay={setDay} timezone={timezone} />
            )}
            {(page === 'day' || page === 'tasks') && (
              <ActivityView
                page={page}
                day={day}
                snapshot={snapshot}
                daily={daily}
                timezone={timezone}
                onSelect={setDialog}
                onNew={() => setDialog('new')}
              />
            )}
            {page === 'month' && monthly && (
              <MonthView
                monthly={monthly}
                month={month}
                setMonth={setMonth}
                chooseDay={chooseDay}
                context={context}
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
      </Shell>
      {dialog && (
        <WorkDialog
          task={dialog === 'new' ? undefined : dialog}
          day={day}
          contexts={contexts}
          defaultContext={activeContext}
          onClose={() => setDialog(null)}
          onSaved={() => {
            void reload().catch((error) => setNotice(error.message));
          }}
        />
      )}
    </>
  );
}
