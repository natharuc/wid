import { summarize, totalDays, type Task, type WorkEvent } from './work.js';
import { eventDay, effectiveFactEvents, makeWorkDigest } from './work-digest.js';

export function taskReport(task: Task, events: WorkEvent[], timezone: string) {
  const days = [...new Set(effectiveFactEvents(events).map((event) => eventDay(event, timezone)))]
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
    digest: days
      .map((day) => makeWorkDigest([task], events, day.day, timezone))
      .filter((digest) => digest.items.length > 0),
  };
}
export type TaskReport = ReturnType<typeof taskReport>;
