import { hours } from './api';
import { Metric } from './WorkComponents';
import type { TaskReport } from '../src/domain/task-report';

export function TaskTimeSummary({ data }: { data: TaskReport }) {
  const { totals, days } = data;
  const recorded = days.some((day) => day.humanTimeRecorded);
  return (
    <div className="stats stats-vertical md:stats-horizontal w-full border border-base-300 bg-base-100">
      <Metric
        label="Horas humanas registradas"
        value={recorded ? hours(totals.humanMinutes) : '—'}
        description={
          recorded
            ? `${hours(totals.measuredMinutes)} medidas · ${hours(totals.estimatedMinutes)} estimadas`
            : 'Tempo desconhecido'
        }
        accent
      />
      <Metric
        label="Dias com registros"
        value={String(days.length)}
        description={`${data.daysWithoutTime} sem horas humanas registradas`}
      />
      <Metric
        label="Execução do agente"
        value={hours(totals.agentMinutes)}
        description="Fora das horas humanas"
      />
      <Metric
        label="Espera / jobs"
        value={hours(totals.waitMinutes)}
        description="Fora das horas humanas"
      />
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
