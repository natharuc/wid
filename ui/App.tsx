import { useState } from 'react';
import { Info, X } from 'lucide-react';
import { hours } from './api';
import { localDay, isCalendarDay } from '../src/domain/time';
import { MonthView } from './MonthView';
import { DayOverview } from './DayOverview';
import { ActivityView } from './ActivityView';
import { AgentsView, SettingsView } from './SettingsView';
import { Shell } from './Shell';
import { pageFromPath } from './navigation';
import { TaskDetailPage } from './TaskDetailPage';
import { useDashboard } from './useDashboard';
import { useWorkContext } from './WorkContext';
import { WorkDigestView } from './WorkDigestView';
export function App() {
  const page = pageFromPath(window.location.pathname);
  const requestedDay = new URLSearchParams(window.location.search).get('day') ?? '';
  const [day, setDay] = useState(
    isCalendarDay(requestedDay) ? requestedDay : localDay(new Date().toISOString()),
  );
  const [month, setMonth] = useState(day.slice(0, 7));
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
  const timezone = settings?.timezone ?? 'America/Sao_Paulo';
  const chooseDay = (day: string) => {
    window.location.assign(href(`/?day=${day}`));
  };
  return (
    <>
      <Shell page={page} taskCount={snapshot.tasks.length} timezone={timezone} contexts={contexts}>
        {notice && (
          <div className="alert alert-soft alert-info" role="status">
            <Info size={20} />
            <span>{notice}</span>
            <button
              className="btn btn-ghost btn-sm btn-square"
              aria-label="Dismiss notice"
              onClick={() => setNotice('')}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex items-center gap-3 py-16" role="status">
            <span className="loading loading-spinner loading-sm" />
            Loading records…
          </div>
        ) : (
          <>
            {page === 'day' && (
              <DayOverview daily={daily} day={day} setDay={setDay} timezone={timezone} />
            )}
            {page === 'day' && daily && (
              <>
                <WorkDigestView
                  digest={daily.digest}
                  events={snapshot.events}
                  timezone={timezone}
                />
                <details className="collapse collapse-arrow border border-base-300 bg-base-100">
                  <summary className="collapse-title font-medium text-sm">
                    History and agent runtime
                  </summary>
                  <div className="collapse-content space-y-5">
                    <p className="text-xs text-base-content/60">
                      Agent runtime and waiting are excluded from human work time.
                    </p>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                      <span>Agents: {hours(daily.minutes.agent_run)}</span>
                      <span>Waiting / jobs: {hours(daily.minutes.wait)}</span>
                    </div>
                    <ActivityView
                      page="day"
                      day={day}
                      snapshot={snapshot}
                      daily={daily}
                      timezone={timezone}
                    />
                  </div>
                </details>
              </>
            )}
            {page === 'tasks' && (
              <ActivityView
                page={page}
                day={day}
                snapshot={snapshot}
                daily={daily}
                timezone={timezone}
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
    </>
  );
}
