import type { Task, WorkEvent } from '../src/domain/work';
import type { Settings } from '../src/infrastructure/settings';
import type { monthReport, summarize } from '../src/domain/work';
export type Snapshot = { tasks: Task[]; events: WorkEvent[] };
export type DayReport = ReturnType<typeof summarize>;
export type MonthReport = ReturnType<typeof monthReport>;
export interface Agent {
  id: string;
  name: string;
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
  if (!response.ok) throw new Error(result.error ?? 'Não foi possível salvar.');
  return result as T;
}
export const hours = (minutes: number) =>
  `${Math.floor(minutes / 60)}h${Math.round(minutes % 60)
    .toString()
    .padStart(2, '0')}`;
export const statusLabel: Record<Task['status'], string> = {
  planned: 'Planejada',
  active: 'Em andamento',
  blocked: 'Bloqueada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};
export const kindLabel: Record<WorkEvent['kind'], string> = {
  planned: 'Intenção registrada',
  started: 'Trabalho iniciado',
  progressed: 'Avanço registrado',
  blocked: 'Bloqueio',
  decided: 'Decisão',
  completed: 'Tarefa concluída',
  cancelled: 'Tarefa cancelada',
  effort: 'Tempo registrado',
  corrected: 'Correção',
};
export type { Settings, Task, WorkEvent };
