export const DEFAULT_CONTEXT = 'OUTROS';

export function contextKey(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR');
}

export interface ContextSummary {
  name: string;
  taskCount: number;
}

export function summarizeContexts(tasks: { context: string }[]): ContextSummary[] {
  const groups = new Map<string, ContextSummary>();
  for (const task of tasks) {
    const key = contextKey(task.context);
    const group = groups.get(key) ?? { name: task.context, taskCount: 0 };
    group.taskCount++;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
