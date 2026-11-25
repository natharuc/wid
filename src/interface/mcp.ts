import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createSchema,
  contextSchema,
  daySchema,
  recordSchema,
  sourceSchema,
  type Source,
} from '../domain/work.js';
import { rules } from '../infrastructure/agent-rules.js';
import { VERSION } from '../version.js';

export interface WorkGateway {
  create(input: unknown, source: Source): Promise<unknown>;
  record(input: unknown, source: Source): Promise<unknown>;
  snapshot(context?: string): Promise<unknown>;
  day(day: string, context?: string): Promise<unknown>;
  month(month: string, context?: string): Promise<unknown>;
  contexts(): Promise<unknown>;
}
const identity = { sessionId: sourceSchema.shape.sessionId, chatUrl: sourceSchema.shape.chatUrl };
const estimateSchema = z.object({
  taskId: z.string().uuid(),
  day: daySchema,
  minutes: z.number().min(0).max(1440),
  basis: z.string().trim().min(1).max(4000),
  confidence: z.enum(['low', 'medium', 'high']),
  idempotencyKey: z.string().min(1).max(200),
  ...identity,
});
export function makeMcp(gateway: WorkGateway, agent: string) {
  const server = new McpServer({ name: 'wid', version: VERSION }, { instructions: rules });
  const result = async (action: () => Promise<unknown>) => {
    try {
      return { content: [{ type: 'text' as const, text: JSON.stringify(await action()) }] };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: 'text' as const, text: (error as Error).message }],
      };
    }
  };
  server.registerTool(
    'wid_create_task',
    {
      description:
        'Register user work intention with a free-form context chosen by the agent. First consult wid_list_contexts and search existing tasks. Reuse a context name or choose a new one; examples are not an enum. Always pass context explicitly for new work. Company/project and corporate work items are optional.',
      inputSchema: createSchema.extend(identity).shape,
    },
    (input) =>
      result(() =>
        gateway.create(input, { agent, sessionId: input.sessionId, chatUrl: input.chatUrl }),
      ),
  );
  server.registerTool(
    'wid_record_event',
    {
      description:
        'Append progress, decision, blocker, completion, correction or cumulative task/day effort. To assign/change a task context, use kind=context_changed and a free-form context; this regroups all its history and preserves an audit event. Effort snapshots replace prior same task/day/category totals. Human measured minutes require explicit user measurement.',
      inputSchema: { ...recordSchema.shape, ...identity },
    },
    (input) =>
      result(() =>
        gateway.record(input, { agent, sessionId: input.sessionId, chatUrl: input.chatUrl }),
      ),
  );
  server.registerTool(
    'wid_estimate_day',
    {
      description:
        'Estimate TOTAL human minutes on one task and local day from conversation evidence. Cumulative snapshot, never increment. Read report_day first. Provide basis and confidence. Do not count agent/job/wait runtime as human work.',
      inputSchema: estimateSchema.shape,
    },
    (input) =>
      result(() =>
        gateway.record(
          {
            taskId: input.taskId,
            kind: 'effort',
            note: input.basis,
            effort: {
              category: 'human_estimated',
              minutes: input.minutes,
              day: input.day,
              confidence: input.confidence,
            },
            idempotencyKey: input.idempotencyKey,
          },
          { agent, sessionId: input.sessionId, chatUrl: input.chatUrl },
        ),
      ),
  );
  server.registerTool(
    'wid_list_tasks',
    {
      description:
        'List persistent tasks and history, optionally filtered by free-form context; reuse matching tasks.',
      inputSchema: { query: z.string().max(200).optional(), context: contextSchema.optional() },
    },
    (input) =>
      result(async () => {
        const snapshot = (await gateway.snapshot(input.context)) as {
          tasks: { id: string; title: string; company: string; project: string; context: string }[];
          events: { taskId: string }[];
        };
        if (!input.query) return snapshot;
        const query = input.query.toLocaleLowerCase();
        const tasks = snapshot.tasks.filter((task) =>
          `${task.title} ${task.company} ${task.project} ${task.context}`
            .toLocaleLowerCase()
            .includes(query),
        );
        const ids = new Set(tasks.map((task) => task.id));
        return { tasks, events: snapshot.events.filter((event) => ids.has(event.taskId)) };
      }),
  );
  server.registerTool(
    'wid_report_day',
    {
      description:
        'Human time by task on local day; measured and estimated totals separate from agent/wait. Unknown coverage is not zero work.',
      inputSchema: { day: daySchema, context: contextSchema.optional() },
    },
    (input) => result(() => gateway.day(input.day, input.context)),
  );
  server.registerTool(
    'wid_report_month',
    {
      description:
        'Answer how many hours the user worked in a month. Report recorded human total, measured/estimated portions, coverage gaps, and overlap warnings. Never claim complete coverage.',
      inputSchema: {
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
        context: contextSchema.optional(),
      },
    },
    (input) => result(() => gateway.month(input.month, input.context)),
  );
  server.registerTool(
    'wid_list_contexts',
    {
      description:
        'List dynamic context names and task counts. There is no fixed catalog: the agent may reuse an existing name or create any new context through wid_create_task or wid_record_event kind=context_changed.',
      inputSchema: {},
    },
    () => result(() => gateway.contexts()),
  );
  return server;
}
