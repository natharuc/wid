import { z } from 'zod';
import { isCalendarDay } from './time.js';

export const calendarDaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCalendarDay, 'Data inválida');
const instant = z.string().datetime({ offset: true });
export const workOutcomes = ['planned', 'advanced', 'delivered', 'blocked', 'cancelled'] as const;
export const workActors = ['human', 'agent', 'joint', 'unknown'] as const;
export const workEvidenceSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .describe(
        'Stable identifier of this immutable observation; reuse when another agent cites the same observation.',
      ),
    kind: z.enum(['human_message', 'agent_message', 'tool_result', 'user_report']),
    summary: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .describe('Concise factual evidence, never a raw prompt/transcript or secret.'),
    sourceId: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .describe('Real source message/tool/event ID when available; never fabricate one.'),
    occurredAt: instant.optional(),
    day: calendarDaySchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.occurredAt && value.day)
      ctx.addIssue({
        code: 'custom',
        message: 'Informe o instante original ou apenas o dia da evidência, não ambos.',
      });
  });
export const workEpisodeSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .describe('Stable episode ID shared across updates of the same participation episode.'),
    phase: z.enum(['definition', 'review', 'decision', 'validation', 'execution', 'other']),
    window: z
      .object({ startedAt: instant, endedAt: instant })
      .strict()
      .refine(
        (value) => Date.parse(value.startedAt) <= Date.parse(value.endedAt),
        'Janela de observação inválida.',
      )
      .optional()
      .describe(
        'Observed conversation window only. Never a measured human interval; omit when timestamps are unavailable.',
      ),
  })
  .strict();
export const structuredWorkSchema = z
  .object({
    day: calendarDaySchema.describe(
      'Original local calendar day of the work fact, even if recorded later.',
    ),
    summary: z
      .string()
      .trim()
      .min(1)
      .max(280)
      .describe('Short result/advance/blocker to display to the user, supported by evidence.'),
    outcome: z.enum(workOutcomes),
    actor: z
      .enum(workActors)
      .describe('Who performed this fact. Agent execution never proves human participation.'),
    evidence: z.array(workEvidenceSchema).min(1).max(20),
    episode: workEpisodeSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.evidence.map((item) => item.id)).size !== value.evidence.length)
      ctx.addIssue({
        code: 'custom',
        message: 'IDs de evidência devem ser únicos no registro.',
        path: ['evidence'],
      });
    if (
      ['human', 'joint'].includes(value.actor) &&
      !value.evidence.some((item) => ['human_message', 'user_report'].includes(item.kind))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Autoria humana exige evidência de participação humana.',
        path: ['actor'],
      });
  });
export type WorkEvidence = z.infer<typeof workEvidenceSchema>;
export type WorkEpisode = z.infer<typeof workEpisodeSchema>;
export type StructuredWork = z.infer<typeof structuredWorkSchema>;
