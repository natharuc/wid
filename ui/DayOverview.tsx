import { ChevronLeft, ChevronRight } from 'lucide-react';
import { localDay } from '../src/domain/time';
import { hours, type DayReport } from './api';
import { Metric } from './WorkComponents';
export function DayOverview({
  daily,
  day,
  setDay,
  timezone,
}: {
  daily?: DayReport;
  day: string;
  setDay: (day: string) => void;
  timezone: string;
}) {
  const changeDay = (offset: number) => {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    setDay(date.toISOString().slice(0, 10));
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="join">
          <button
            className="btn btn-square join-item bg-base-100"
            aria-label="Dia anterior"
            onClick={() => changeDay(-1)}
          >
            <ChevronLeft size={17} />
          </button>
          <input
            className="input join-item w-auto"
            aria-label="Dia consultado"
            type="date"
            value={day}
            onChange={(event) => event.target.value && setDay(event.target.value)}
          />
          <button
            className="btn btn-square join-item bg-base-100"
            aria-label="Próximo dia"
            onClick={() => changeDay(1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setDay(localDay(new Date().toISOString(), timezone))}
        >
          Hoje
        </button>
        <span className="badge badge-soft badge-warning sm:ml-auto">
          {daily?.coverage === 'unknown' ? 'Sem registros' : 'Cobertura parcial'}
        </span>
      </div>
      <div className="stats stats-vertical md:stats-horizontal w-full border border-base-300 bg-base-100">
        <Metric
          label="Horas humanas registradas"
          value={daily?.humanTimeRecorded ? hours(daily.humanMinutes) : '—'}
          description={
            daily?.humanTimeRecorded
              ? `${hours(daily.minutes.human_measured)} medidas · ${hours(daily.minutes.human_estimated)} estimadas`
              : 'Tempo humano desconhecido'
          }
          accent
        />
        <Metric
          label="Tarefas no dia"
          value={String(daily?.tasks ?? 0)}
          description={`${daily?.events ?? 0} eventos registrados`}
        />
        <Metric
          label="Execução do agente"
          value={hours(daily?.minutes.agent_run ?? 0)}
          description="Fora das horas humanas"
        />
        <Metric
          label="Espera / jobs"
          value={hours(daily?.minutes.wait ?? 0)}
          description="Fora das horas humanas"
        />
      </div>
    </>
  );
}
