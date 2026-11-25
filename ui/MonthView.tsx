import { Download, Info } from 'lucide-react';
import { hours, type MonthReport } from './api';
import { Metric } from './WorkComponents';
export function MonthView({
  monthly,
  month,
  setMonth,
  chooseDay,
  context,
}: {
  monthly: MonthReport;
  month: string;
  setMonth: (month: string) => void;
  chooseDay: (day: string) => void;
  context: string;
}) {
  const offset = (new Date(`${month}-01T12:00:00Z`).getUTCDay() + 6) % 7;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input w-auto"
          aria-label="Mês consultado"
          type="month"
          value={month}
          onChange={(event) => event.target.value && setMonth(event.target.value)}
        />
        <span className="badge badge-warning badge-soft">Cobertura parcial</span>
        <a
          href={`/api/export${context ? `?context=${encodeURIComponent(context)}` : ''}`}
          download
          className="btn btn-outline btn-sm sm:ml-auto"
        >
          <Download size={16} />
          Exportar
        </a>
      </div>
      <div className="stats stats-vertical sm:stats-horizontal w-full border border-base-300 bg-base-100">
        <Metric
          label="Horas humanas registradas"
          value={hours(monthly.totals.humanMinutes)}
          description={`${hours(monthly.totals.measuredMinutes)} medidas · ${hours(monthly.totals.estimatedMinutes)} estimadas`}
          accent
        />
        <Metric
          label="Dias com registro"
          value={String(monthly.coveredDays)}
          description={`${monthly.unknownDays} dias sem registros`}
        />
        <Metric
          label="Dias sem tempo informado"
          value={String(monthly.daysWithoutTime)}
          description="Há atividade, mas sem duração"
        />
      </div>
      <section className="card bg-base-100 border border-base-300">
        <div className="card-body p-4 sm:p-6 gap-5">
          <h2 className="card-title text-base">Dedicação por dia</h2>
          <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center">
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((label) => (
              <div key={label} className="py-2 text-xs font-medium text-base-content/60">
                {label}
              </div>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {monthly.days.map((item) => (
              <button
                key={item.day}
                onClick={() => chooseDay(item.day)}
                aria-label={`${Number(item.day.slice(8))}, ${item.humanMinutes ? hours(item.humanMinutes) : item.events ? 'tempo não informado' : 'sem registro'}`}
                className={`btn h-auto min-h-20 flex-col gap-1 px-1 py-3 sm:min-h-24 sm:gap-2 ${item.events ? 'btn-soft btn-primary' : 'btn-ghost border-base-300'}`}
              >
                <span className="text-xs">{Number(item.day.slice(8))}</span>
                <span
                  className={
                    item.humanMinutes
                      ? 'text-xs sm:text-base tabular-nums'
                      : 'text-xs font-normal text-base-content/45'
                  }
                >
                  {item.humanMinutes ? hours(item.humanMinutes) : '—'}
                </span>
                {item.events > 0 && (
                  <span className="hidden sm:block text-xs font-normal">
                    {item.tasks} tarefa{item.tasks > 1 ? 's' : ''}
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-base-content/60">
            — Sem tempo registrado. Clique em um dia para consultar as tarefas.
          </p>
        </div>
      </section>
      {monthly.warnings.map((message) => (
        <div key={message} role="alert" className="alert alert-warning alert-soft">
          {message}
        </div>
      ))}
      <div className="alert alert-info alert-soft">
        <Info size={20} />
        <p className="text-sm">
          O total inclui estimativas. Execução dos agentes ({hours(monthly.totals.agentMinutes)}) e
          espera ({hours(monthly.totals.waitMinutes)}) ficam fora das horas humanas. Dias sem
          registro têm cobertura desconhecida.
        </p>
      </div>
    </>
  );
}
