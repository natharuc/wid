import type { StructuredWork, WorkEvidence, WorkEpisode } from '../src/domain/work-evidence';
import type { DigestFact } from '../src/domain/work-digest';

export const outcomeLabel: Record<DigestFact['outcome'], string> = {
  planned: 'Planejado',
  advanced: 'Avançou',
  delivered: 'Entregue',
  blocked: 'Bloqueado',
  cancelled: 'Cancelado',
  recorded: 'Registro anterior',
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
  human: 'Você',
  agent: 'Agente',
  joint: 'Você e IA',
  unknown: 'Autoria não informada',
};
export const evidenceLabel: Record<WorkEvidence['kind'], string> = {
  human_message: 'Mensagem do usuário',
  agent_message: 'Mensagem do agente',
  tool_result: 'Resultado de ferramenta',
  user_report: 'Relato do usuário',
};
export const phaseLabel: Record<WorkEpisode['phase'], string> = {
  definition: 'Definição',
  review: 'Revisão',
  decision: 'Decisão',
  validation: 'Validação',
  execution: 'Execução',
  other: 'Outra participação',
};
export const formatDay = (day: string) => day.split('-').reverse().join('/');
