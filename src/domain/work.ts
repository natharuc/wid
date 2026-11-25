import { z } from 'zod';
import { localDay, isCalendarDay } from './time.js';
export { localDay } from './time.js';

export const eventKinds = [
  'planned',
  'started',
  'progressed',
  'blocked',
  'decided',
  'completed',
  'cancelled',
  'effort',
  'corrected',
  'context_changed',
  'references_added',
] as const;
export const statuses = ['planned', 'active', 'blocked', 'completed', 'cancelled'] as const;
export type Status = (typeof statuses)[number];
export class WorkError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const text = z.string().trim().min(1).max(4000);
export const referenceSchema = z.object({
  label: z.string().trim().min(1).max(100),
  url: z
    .string()
    .url()
    .max(2048)
    .refine((value) => /^(https?:|thread:)/.test(value), 'Use http, https or thread URLs'),
});
export const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCalendarDay, 'Data inválida');
export const effortSchema = z
  .object({
    category: z.enum(['human_measured', 'human_estimated', 'agent_run', 'wait']),
    minutes: z.number().min(0).max(1440),
    day: daySchema,
    confidence: z.enum(['low', 'medium', 'high']).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.category === 'human_estimated' && !value.confidence)
      ctx.addIssue({
        code: 'custom',
        message: 'Estimativas exigem grau de confiança',
        path: ['confidence'],
      });
  });
export const sourceSchema = z.object({
  agent: z.string().min(1).max(60),
  sessionId: z.string().max(200).optional(),
  chatUrl: z.string().max(2048).optional(),
});
export const contextSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .describe(
    'Free-form work context chosen by the agent, e.g. MAG, POLLARIS, SEDUCAO or any other name. Reuse wid_list_contexts names when appropriate; there is no fixed catalog. Separate from company/project.',
  );
export const createSchema = z.object({
  title: z.string().trim().min(1).max(240),
  company: z.string().trim().max(100).default(''),
  project: z.string().trim().max(120).default(''),
  references: z
    .array(referenceSchema)
    .max(20)
    .default([])
    .describe(
      'Optional links to the actual work item, GitHub issue/PR, Azure DevOps, Slack or chat. Provide a short descriptive label and the real URL; never invent a link.',
    ),
  note: text.optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  idempotencyKey: z.string().min(1).max(200),
  context: contextSchema.optional(),
});
export const recordSchema = z
  .object({
    taskId: z.string().uuid(),
    kind: z.enum(eventKinds).exclude(['planned']),
    note: text,
    occurredAt: z.string().datetime({ offset: true }).optional(),
    effort: effortSchema.optional(),
    correctsEventId: z.string().uuid().optional(),
    idempotencyKey: z.string().min(1).max(200),
    context: contextSchema.optional(),
    references: z.array(referenceSchema).min(1).max(20).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'references_added' && !value.references)
      ctx.addIssue({ code: 'custom', message: 'Informe as referências.', path: ['references'] });
    if (value.kind !== 'references_added' && value.references)
      ctx.addIssue({
        code: 'custom',
        message: 'Use references_added para adicionar referências.',
        path: ['references'],
      });
    if (value.kind === 'context_changed' && !value.context)
      ctx.addIssue({ code: 'custom', message: 'Informe o novo contexto.', path: ['context'] });
    if (value.kind !== 'context_changed' && value.context)
      ctx.addIssue({
        code: 'custom',
        message: 'Use context_changed para alterar o contexto.',
        path: ['context'],
      });
    if (value.kind === 'corrected' && !value.correctsEventId)
      ctx.addIssue({
        code: 'custom',
        message: 'A correction must identify the original event',
        path: ['correctsEventId'],
      });
    if (value.kind !== 'corrected' && value.correctsEventId)
      ctx.addIssue({
        code: 'custom',
        message: 'Only corrections may replace an event',
        path: ['correctsEventId'],
      });
    if (value.kind === 'effort' && !value.effort)
      ctx.addIssue({
        code: 'custom',
        message: 'Effort requires a category and minutes',
        path: ['effort'],
      });
  });
export type CreateInput = z.input<typeof createSchema>;
export type RecordInput = z.infer<typeof recordSchema>;
export type Source = z.infer<typeof sourceSchema>;
export interface Task {
  id: string;
  title: string;
  context: string;
  company: string;
  project: string;
  status: Status;
  references: z.infer<typeof referenceSchema>[];
  createdAt: string;
  updatedAt: string;
}
export function addReferences(
  current: Task['references'],
  added: Task['references'],
): Task['references'] {
  const links = new Map(current.map((ref) => [ref.url, ref]));
  for (const ref of added) if (!links.has(ref.url)) links.set(ref.url, ref);
  if (links.size > 20) throw new WorkError('A tarefa aceita no máximo 20 referências.');
  return [...links.values()];
}
export interface WorkEvent {
  id: string;
  taskId: string;
  kind: (typeof eventKinds)[number];
  note: string;
  source: Source;
  occurredAt: string;
  recordedAt: string;
  effort?: z.infer<typeof effortSchema>;
  correctsEventId?: string;
  context?: string;
  previousContext?: string;
  references?: Task['references'];
}
export interface CommandResult {
  task: Task;
  event: WorkEvent;
}
export function nextStatus(current: Status, kind: WorkEvent['kind']): Status {
  if (
    (current === 'completed' || current === 'cancelled') &&
    ['started', 'progressed', 'blocked', 'completed', 'cancelled'].includes(kind)
  ) {
    throw new WorkError('Tarefa encerrada. Registre uma nota ou crie uma nova tarefa.');
  }
  return (
    (
      {
        planned: 'planned',
        started: 'active',
        blocked: 'blocked',
        completed: 'completed',
        cancelled: 'cancelled',
      } as Partial<Record<WorkEvent['kind'], Status>>
    )[kind] ?? current
  );
}
export function summarize(events: WorkEvent[], day: string, timezone: string) {
  const replaced = new Set(
    events.flatMap((event) => (event.correctsEventId ? [event.correctsEventId] : [])),
  );
  const daily = events.filter(
    (event) => (event.effort?.day ?? localDay(event.occurredAt, timezone)) === day,
  );
  const minutes = { human_measured: 0, human_estimated: 0, agent_run: 0, wait: 0 };
  const latest = new Map<string, WorkEvent>();
  for (const event of daily)
    if (!replaced.has(event.id) && event.effort) {
      const key = `${event.taskId}:${event.effort.category}`;
      const prior = latest.get(key);
      if (!prior || event.recordedAt >= prior.recordedAt) latest.set(key, event);
    }
  const taskMinutes = new Map<string, typeof minutes>();
  for (const event of latest.values()) {
    const values = taskMinutes.get(event.taskId) ?? {
      human_measured: 0,
      human_estimated: 0,
      agent_run: 0,
      wait: 0,
    };
    values[event.effort!.category] = event.effort!.minutes;
    taskMinutes.set(event.taskId, values);
  }
  for (const values of taskMinutes.values()) {
    minutes.human_measured += values.human_measured;
    // Each estimate is a cumulative task/day total. Measured time is included, never added twice.
    minutes.human_estimated += Math.max(0, values.human_estimated - values.human_measured);
    minutes.agent_run += values.agent_run;
    minutes.wait += values.wait;
  }
  return {
    day,
    timezone,
    events: daily.length,
    tasks: new Set(daily.map((event) => event.taskId)).size,
    minutes,
    humanMinutes: minutes.human_measured + minutes.human_estimated,
    humanTimeRecorded: [...latest.values()].some(
      (event) =>
        event.effort?.category === 'human_measured' || event.effort?.category === 'human_estimated',
    ),
    taskMinutes: Object.fromEntries(
      [...taskMinutes].map(([id, value]) => [
        id,
        { ...value, humanMinutes: Math.max(value.human_measured, value.human_estimated) },
      ]),
    ),
    coverage: daily.length ? 'partial' : 'unknown',
  };
}
export function monthReport(
  events: WorkEvent[],
  month: string,
  timezone: string,
  today = localDay(new Date().toISOString(), timezone),
) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new WorkError('Use o mês no formato AAAA-MM.');
  const [year, index] = month.split('-').map(Number);
  const days = Array.from({ length: new Date(Date.UTC(year, index, 0)).getUTCDate() }, (_, i) =>
    summarize(events, `${month}-${String(i + 1).padStart(2, '0')}`, timezone),
  );
  const totals = totalDays(days);
  return {
    month,
    timezone,
    totals,
    days,
    coveredDays: days.filter((day) => day.events > 0).length,
    unknownDays: days.filter((day) => day.day <= today && !day.events).length,
    daysWithoutTime: days.filter((day) => day.events > 0 && !day.humanMinutes).length,
    warnings: days
      .filter((day) => day.humanMinutes > 1440)
      .map((day) => `${day.day}: totais acima de 24h; revise sobreposição entre tarefas.`),
    coverage: 'partial',
  };
}
export function totalDays(days: ReturnType<typeof summarize>[]) {
  return days.reduce(
    (sum, day) => ({
      humanMinutes: sum.humanMinutes + day.humanMinutes,
      measuredMinutes: sum.measuredMinutes + day.minutes.human_measured,
      estimatedMinutes: sum.estimatedMinutes + day.minutes.human_estimated,
      agentMinutes: sum.agentMinutes + day.minutes.agent_run,
      waitMinutes: sum.waitMinutes + day.minutes.wait,
    }),
    { humanMinutes: 0, measuredMinutes: 0, estimatedMinutes: 0, agentMinutes: 0, waitMinutes: 0 },
  );
}
