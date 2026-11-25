import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const dateTitle = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(day + 'T12:00:00Z'));
  const changeDay = (offset: number) => {
    const date = new Date(day + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + offset);
    setDay(date.toISOString().slice(0, 10));
  };
  return (
    <>
      <div className="date-row">
        <div className="date-control">
          <button className="icon-btn" aria-label="Dia anterior" onClick={() => changeDay(-1)}>
            <ChevronLeft size={16} />
          </button>
          <label className="date-label">
            <CalendarDays size={16} />
            <span>{dateTitle}</span>
            <input
              aria-label="Dia consultado"
              type="date"
              value={day}
              onChange={(event) => event.target.value && setDay(event.target.value)}
            />
          </label>
          <button className="icon-btn" aria-label="Próximo dia" onClick={() => changeDay(1)}>
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          className="text-btn"
          onClick={() => setDay(localDay(new Date().toISOString(), timezone))}
        >
          Hoje
        </button>
        <span className="coverage">
          <i />
          {daily?.coverage === 'unknown' ? 'Sem registros neste dia' : 'Cobertura parcial'}
        </span>
      </div>
      <div className="metrics">
        <Metric
          label="DEDICAÇÃO HUMANA"
          value={hours(daily?.humanMinutes ?? 0)}
          description={`${hours(daily?.minutes.human_measured ?? 0)} medidas · ${hours(daily?.minutes.human_estimated ?? 0)} estimadas`}
          accent
        />
        <Metric
          label="TAREFAS REGISTRADAS"
          value={String(daily?.tasks ?? 0).padStart(2, '0')}
          description={`${daily?.events ?? 0} eventos no dia`}
        />
        <Metric
          label="EXECUÇÃO DO AGENTE"
          value={hours(daily?.minutes.agent_run ?? 0)}
          description="Registrada separadamente"
        />
        <Metric
          label="ESPERA / JOBS"
          value={hours(daily?.minutes.wait ?? 0)}
          description="Sem somar às horas humanas"
        />
      </div>
    </>
  );
}
