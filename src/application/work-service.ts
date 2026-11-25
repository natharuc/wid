import { createHash, randomUUID } from 'node:crypto';
import {
  createSchema,
  addReferences,
  nextStatus,
  recordSchema,
  sourceSchema,
  WorkError,
  type Source,
  type Task,
  type WorkEvent,
} from '../domain/work.js';
import type { WorkStore } from './ports.js';
import { contextKey, DEFAULT_CONTEXT, summarizeContexts } from '../domain/context.js';
import { taskReport } from '../domain/task-report.js';
import { validateWorkEvidence } from './work-evidence-validation.js';

export class WorkService {
  constructor(
    private readonly store: WorkStore,
    private readonly now = () => new Date().toISOString(),
    private readonly timezone = async () => 'America/Sao_Paulo',
  ) {}
  async create(input: unknown, identity: Source) {
    const data = createSchema.parse(input);
    const source = sourceSchema.parse(identity);
    return this.store.command(
      source,
      data.idempotencyKey,
      this.hash({ action: 'create', data, source }),
      async (unit) => {
        const now = this.now();
        const occurredAt = data.occurredAt ?? now;
        this.validateTime(occurredAt, now);
        if (data.work)
          validateWorkEvidence(data.work, [], now, await this.timezone(), data.occurredAt);
        const task: Task = {
          id: randomUUID(),
          title: data.title,
          context: data.context ?? DEFAULT_CONTEXT,
          company: data.company,
          project: data.project,
          references: data.references,
          status: 'planned',
          createdAt: now,
          updatedAt: now,
        };
        const event: WorkEvent = {
          id: randomUUID(),
          taskId: task.id,
          kind: 'planned',
          note: data.note ?? data.title,
          source,
          occurredAt,
          recordedAt: now,
          context: task.context,
          ...(data.work ? { work: data.work } : {}),
        };
        await unit.saveTask(task, true);
        await unit.append(event);
        return { task, event };
      },
    );
  }
  async record(input: unknown, identity: Source) {
    const data = recordSchema.parse(input);
    const source = sourceSchema.parse(identity);
    return this.store.command(
      source,
      data.idempotencyKey,
      this.hash({ action: 'record', data, source }),
      async (unit) => {
        const task = await unit.task(data.taskId);
        if (!task) throw new WorkError('Tarefa não encontrada.', 404);
        const now = this.now();
        const occurredAt = data.occurredAt ?? now;
        this.validateTime(occurredAt, now);
        if (data.work)
          validateWorkEvidence(
            data.work,
            await unit.events(task.id),
            now,
            await this.timezone(),
            data.occurredAt,
          );
        if (data.correctsEventId) {
          const original = await unit.event(data.correctsEventId);
          if (!original || original.taskId !== task.id)
            throw new WorkError('O evento corrigido deve pertencer à tarefa.');
          // Corrections are append-only annotations and replacement effort, never silent status rewrites.
          if (original.kind === 'corrected')
            throw new WorkError('Corrija o evento original, não outra correção.');
          if (original.work && !data.work && !data.effort)
            throw new WorkError(
              'Para corrigir um fato estruturado, envie a substituição em work com o dia factual e as evidências.',
            );
        }
        if (data.kind === 'historical_note' && Date.parse(occurredAt) > Date.parse(now))
          throw new WorkError('Anotação histórica exige um horário já ocorrido.');
        task.status = nextStatus(task.status, data.kind);
        const previousContext = task.context;
        if (data.kind === 'context_changed') task.context = data.context!;
        if (data.kind === 'references_added') {
          task.references = addReferences(task.references, data.references!);
        }
        task.updatedAt = now;
        const event: WorkEvent = {
          id: randomUUID(),
          taskId: task.id,
          kind: data.kind,
          note: data.note,
          source,
          occurredAt,
          recordedAt: now,
          effort: data.effort,
          correctsEventId: data.correctsEventId,
          ...(data.kind === 'context_changed' ? { context: task.context, previousContext } : {}),
          ...(data.kind === 'references_added' ? { references: data.references } : {}),
          ...(data.kind === 'historical_note'
            ? { references: data.references, context: task.context }
            : {}),
          ...(data.work
            ? { work: data.work, references: data.references, context: task.context }
            : {}),
        };
        await unit.append(event);
        await unit.saveTask(task);
        return { task, event };
      },
    );
  }
  async snapshot(context?: string) {
    const tasks = (await this.store.tasks()).filter(
      (task) => !context || contextKey(task.context) === contextKey(context),
    );
    const ids = new Set(tasks.map((task) => task.id));
    const events = (await this.store.events()).filter((event) => ids.has(event.taskId));
    return { tasks, events };
  }
  async contexts() {
    return summarizeContexts(await this.store.tasks());
  }
  async detail(id: string, timezone: string, context?: string) {
    const task = await this.store.task(id);
    if (!task || (context && contextKey(task.context) !== contextKey(context)))
      throw new WorkError(
        context ? 'Tarefa não encontrada neste contexto.' : 'Tarefa não encontrada.',
        404,
      );
    return taskReport(task, await this.store.events(id), timezone);
  }
  private validateTime(value: string, now: string) {
    if (Date.parse(value) > Date.parse(now) + 300_000)
      throw new WorkError('Use um horário ocorrido; registre intenções futuras na descrição.');
  }
  private hash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}
