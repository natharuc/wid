import { hours } from './api';
import type { TaskReport } from '../src/domain/task-report';

export function TaskTimeSummary({ data }: { data: TaskReport }) {
  const { totals, days } = data;
  const recorded = days.some((day) => day.humanTimeRecorded);
  return (
    <div className="space-y-3 border-y border-base-300 py-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <span className="text-sm font-medium">Dedicação humana registrada</span>
        <strong className="text-2xl tabular-nums text-primary">
          {recorded ? hours(totals.humanMinutes) : '—'}
        </strong>
        <span className="text-xs text-base-content/60">
          {recorded
            ? `${hours(totals.measuredMinutes)} medidas · ${hours(totals.estimatedMinutes)} estimadas`
            : 'Tempo humano desconhecido'}
        </span>
      </div>
      <p className="text-xs text-base-content/60">
        {days.length} dias com registros · {data.daysWithoutTime} sem horas humanas registradas
      </p>
      <details className="text-xs text-base-content/60">
        <summary className="cursor-pointer">Execução dos agentes e espera</summary>
        <p className="mt-2">
          {hours(totals.agentMinutes)} de execução do agente · {hours(totals.waitMinutes)} de
          espera. Fora das horas humanas.
        </p>
      </details>
    </div>
  );
}
export function TaskDayHours({ data }: { data: TaskReport }) {
  return (
    <section className="card bg-base-100 border border-base-300">
      <div className="card-body p-5 gap-4">
        <h2 className="card-title text-base">Horas por dia</h2>
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Dia</th>
                <th className="text-right">Medidas</th>
                <th className="text-right">Estimadas</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((day) => (
                <tr key={day.day}>
                  <td className="whitespace-nowrap">{day.day.split('-').reverse().join('/')}</td>
                  <td className="text-right tabular-nums">
                    {day.humanTimeRecorded ? hours(day.minutes.human_measured) : '—'}
                  </td>
                  <td className="text-right tabular-nums">
                    {day.humanTimeRecorded ? hours(day.minutes.human_estimated) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.days.some((day) => day.humanTimeRecorded) && (
          <p className="text-xs text-base-content/60">
            Sem tempo humano registrado. Isso não significa que não houve trabalho.
          </p>
        )}
      </div>
    </section>
  );
}
