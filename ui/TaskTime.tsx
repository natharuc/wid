import { hours } from './api';
import type { TaskReport } from '../src/domain/task-report';
import { formatDay } from './workLabels';

export function TaskTimeSummary({ data }: { data: TaskReport }) {
  const { totals, days } = data;
  const recorded = days.some((day) => day.humanTimeRecorded);
  return (
    <div className="space-y-3 border-y border-base-300 py-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <span className="text-sm font-medium">Recorded human work time</span>
        <strong className="text-2xl tabular-nums text-primary">
          {recorded ? hours(totals.humanMinutes) : '—'}
        </strong>
        <span className="text-xs text-base-content/60">
          {recorded
            ? `${hours(totals.measuredMinutes)} measured · ${hours(totals.estimatedMinutes)} estimated`
            : 'Human work time unknown'}
        </span>
      </div>
      <p className="text-xs text-base-content/60">
        Days with records: {days.length} · Without human work time: {data.daysWithoutTime}
      </p>
      <details className="text-xs text-base-content/60">
        <summary className="cursor-pointer">Agent runtime and waiting</summary>
        <p className="mt-2">
          {hours(totals.agentMinutes)} agent runtime · {hours(totals.waitMinutes)} waiting. Excluded
          from human work time.
        </p>
      </details>
    </div>
  );
}
export function TaskDayHours({ data }: { data: TaskReport }) {
  return (
    <section className="card bg-base-100 border border-base-300">
      <div className="card-body p-5 gap-4">
        <h2 className="card-title text-base">Hours by day</h2>
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Day</th>
                <th className="text-right">Measured</th>
                <th className="text-right">Estimated</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((day) => (
                <tr key={day.day}>
                  <td className="whitespace-nowrap">{formatDay(day.day)}</td>
                  <td className="text-right tabular-nums">
                    {day.humanTimeRecorded ? hours(day.minutes.human_measured) : '—'}
                  </td>
                  <td className="text-right tabular-nums">
                    {day.humanTimeRecorded ? hours(day.minutes.human_estimated) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.days.some((day) => day.humanTimeRecorded) && (
          <p className="text-xs text-base-content/60">
            No human work time recorded. This does not mean no work took place.
          </p>
        )}
      </div>
    </section>
  );
}
