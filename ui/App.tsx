import { useState } from 'react';
import { Info, X } from 'lucide-react';
import { localDay, isCalendarDay } from '../src/domain/time';
import { type Task } from './api';
import { WorkDialog } from './WorkDialog';
import { MonthView } from './MonthView';
import { DayOverview } from './DayOverview';
import { ActivityView } from './ActivityView';
import { AgentsView, SettingsView } from './SettingsView';
import { Shell } from './Shell';
import { pageFromPath } from './navigation';
import { TaskDetailPage } from './TaskDetailPage';
import { useDashboard } from './useDashboard';
import { useWorkContext } from './WorkContext';
import { contextKey, DEFAULT_CONTEXT } from '../src/domain/context';
export function App() {
  const page = pageFromPath(window.location.pathname);
  const requestedDay = new URLSearchParams(window.location.search).get('day') ?? '';
  const [day, setDay] = useState(
    isCalendarDay(requestedDay) ? requestedDay : localDay(new Date().toISOString()),
  );
  const [month, setMonth] = useState(day.slice(0, 7));
  const [dialog, setDialog] = useState<Task | 'new' | null>(null);
  const { context, href } = useWorkContext();
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
    contexts.find((item) => contextKey(item.name) === contextKey(context))?.name ??
    (context || DEFAULT_CONTEXT);
  const timezone = settings?.timezone ?? 'America/Sao_Paulo';
  const chooseDay = (day: string) => {
    window.location.assign(href(`/?day=${day}`));
  };
  return (
    <>
      <Shell
        page={page}
        taskCount={snapshot.tasks.length}
        timezone={timezone}
        contexts={contexts}
        newTask={() => setDialog('new')}
      >
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
            {page === 'task' && <TaskDetailPage taskId={window.location.pathname.split('/')[2]} />}
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
