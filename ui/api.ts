import type { Task, WorkEvent } from '../src/domain/work';
import type { Settings } from '../src/infrastructure/settings';
import type { monthReport, summarize } from '../src/domain/work';
import type { WorkDigest } from '../src/domain/work-digest';
export type Snapshot = { tasks: Task[]; events: WorkEvent[] };
export type DayReport = ReturnType<typeof summarize> & { digest: WorkDigest };
export type MonthReport = ReturnType<typeof monthReport>;
export interface Agent {
  id: string;
  name: string;
  description: string;
  detected: boolean;
  enabled: boolean;
  rules: string;
  hook: string | null;
  configPath: string;
}
export async function api<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? 'GET' : method,
    headers: { 'Content-Type': 'application/json', 'X-WID-Client': 'wid' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'The request could not be completed.');
  return result as T;
}
export const hours = (minutes: number) =>
  `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)
    .toString()
    .padStart(2, '0')}m`;
export const statusLabel: Record<Task['status'], string> = {
  planned: 'Planned',
  active: 'In progress',
  blocked: 'Blocked',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
export const kindLabel: Record<WorkEvent['kind'], string> = {
  planned: 'Intention recorded',
  started: 'Work started',
  progressed: 'Progress recorded',
  blocked: 'Blocker',
  decided: 'Decision',
  completed: 'Task completed',
  cancelled: 'Task cancelled',
  effort: 'Time recorded',
  corrected: 'Correction',
  context_changed: 'Context changed',
  references_added: 'References added',
  historical_note: 'Historical note',
  work_recorded: 'Work recorded',
};
export type { Settings, Task, WorkEvent };
