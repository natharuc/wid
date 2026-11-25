import { ChevronLeft, ChevronRight } from 'lucide-react';
import { localDay } from '../src/domain/time';
import { hours, type DayReport } from './api';
export function DayOverview({
  daily,
  day,
  setDay,
  timezone,
}: {
  daily?: DayReport;
  day: string;
  setDay: (day: string) => void;
  timezone: string;
}) {
  const changeDay = (offset: number) => {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    setDay(date.toISOString().slice(0, 10));
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="join">
          <button
            className="btn btn-square join-item bg-base-100"
            aria-label="Previous day"
            onClick={() => changeDay(-1)}
          >
            <ChevronLeft size={17} />
          </button>
          <input
            className="input join-item w-auto"
            aria-label="Selected day"
            type="date"
            value={day}
            onChange={(event) => event.target.value && setDay(event.target.value)}
          />
          <button
            className="btn btn-square join-item bg-base-100"
            aria-label="Next day"
            onClick={() => changeDay(1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setDay(localDay(new Date().toISOString(), timezone))}
        >
          Today
        </button>
        <span className="badge badge-soft badge-warning sm:ml-auto">
          {daily?.coverage === 'unknown' ? 'No records' : 'Partial coverage'}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-base-300 py-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm font-medium">Recorded human work time</span>
          <strong className="text-2xl tabular-nums text-primary">
            {daily?.humanTimeRecorded ? hours(daily.humanMinutes) : '—'}
          </strong>
        </div>
        <p className="text-xs text-base-content/60">
          {daily?.humanTimeRecorded
            ? `${hours(daily.minutes.human_measured)} measured · ${hours(daily.minutes.human_estimated)} estimated`
            : 'Human work time unknown'}
        </p>
      </div>
    </>
  );
}
