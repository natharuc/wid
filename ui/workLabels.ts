import type { StructuredWork, WorkEvidence, WorkEpisode } from '../src/domain/work-evidence';
import type { DigestFact } from '../src/domain/work-digest';

export const outcomeLabel: Record<DigestFact['outcome'], string> = {
  planned: 'Planned',
  advanced: 'Advanced',
  delivered: 'Delivered',
  blocked: 'Blocked',
  cancelled: 'Cancelled',
  recorded: 'Earlier record',
};
export const outcomeClass: Record<DigestFact['outcome'], string> = {
  planned: 'badge-ghost',
  advanced: 'badge-info',
  delivered: 'badge-success',
  blocked: 'badge-warning',
  cancelled: 'badge-ghost',
  recorded: 'badge-ghost',
};
export const actorLabel: Record<StructuredWork['actor'], string> = {
  human: 'You',
  agent: 'Agent',
  joint: 'You and AI',
  unknown: 'Actor unknown',
};
export const evidenceLabel: Record<WorkEvidence['kind'], string> = {
  human_message: 'User message',
  agent_message: 'Agent message',
  tool_result: 'Tool result',
  user_report: 'User report',
};
export const phaseLabel: Record<WorkEpisode['phase'], string> = {
  definition: 'Definition',
  review: 'Review',
  decision: 'Decision',
  validation: 'Validation',
  execution: 'Execution',
  other: 'Other participation',
};
export const formatDay = (day: string) =>
  new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));
