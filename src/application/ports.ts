import type { CommandResult, Source, Task, WorkEvent } from '../domain/work.js';
export interface WorkUnit {
  task(id: string): Promise<Task | undefined>;
  saveTask(task: Task, create?: boolean): Promise<void>;
  event(id: string): Promise<WorkEvent | undefined>;
  append(event: WorkEvent): Promise<void>;
}
export interface WorkStore {
  command(
    source: Source,
    key: string,
    fingerprint: string,
    action: (unit: WorkUnit) => Promise<CommandResult>,
  ): Promise<CommandResult>;
  tasks(): Promise<Task[]>;
  events(): Promise<WorkEvent[]>;
}
