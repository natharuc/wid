import { localDay, summarize, totalDays, type Task, type WorkEvent } from './work.js';

export function taskReport(task: Task, events: WorkEvent[], timezone: string) {
  const days = [
    ...new Set(events.map((event) => event.effort?.day ?? localDay(event.occurredAt, timezone))),
  ]
    .sort()
    .reverse()
    .map((day) => summarize(events, day, timezone));
  const totals = totalDays(days);
  return {
    task,
    events,
    days,
    totals,
    timezone,
    daysWithoutTime: days.filter((day) => !day.humanTimeRecorded).length,
  };
}
export type TaskReport = ReturnType<typeof taskReport>;
