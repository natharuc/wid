import { ArrowDownToLine, CalendarDays, Clock3 } from 'lucide-react';
import { hours, type MonthReport } from './api';
export function MonthView({
  monthly,
  month,
  setMonth,
  chooseDay,
}: {
  monthly: MonthReport;
  month: string;
  setMonth: (month: string) => void;
  chooseDay: (day: string) => void;
}) {
  const monthTitle = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(month + '-01T12:00:00Z'));
  return (
    <>
      <div className="date-row">
        <label className="month-picker">
          <CalendarDays size={18} />
          <input
            aria-label="Mês consultado"
            type="month"
            value={month}
            onChange={(event) => event.target.value && setMonth(event.target.value)}
          />
        </label>
        <span className="coverage">
          <i />
          Cobertura parcial
        </span>
        <a href="/api/export" className="text-btn">
          <ArrowDownToLine size={15} />
          Exportar
        </a>
      </div>
      <div className="month-hero">
        <div>
          <span className="eyebrow">
            HORAS HUMANAS REGISTRADAS · {monthTitle.toLocaleUpperCase()}
          </span>
          <div className="month-total">
            {hours(monthly.totals.humanMinutes)}
            <span>
              {hours(monthly.totals.measuredMinutes)} medidas
              <br />
              {hours(monthly.totals.estimatedMinutes)} estimadas
            </span>
          </div>
          <p>
            O total inclui estimativas de dedicação humana. {monthly.unknownDays} dias sem registros
            e {monthly.daysWithoutTime} dias registrados sem estimativa de tempo.
          </p>
        </div>
        <div className="month-coverage">
          <span>{String(monthly.coveredDays).padStart(2, '0')}</span>
          <p>
            dias com
            <br />
            algum registro
          </p>
        </div>
      </div>
      <div className="section-title">
        <h2>Dedicação por dia</h2>
        <span className="mono muted">{monthTitle}</span>
      </div>
      <div className="calendar">
        <div className="calendar-week">
          {['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="calendar-days">
          {Array.from(
            { length: (new Date(`${month}-01T12:00:00Z`).getUTCDay() + 6) % 7 },
            (_, index) => (
              <div key={`pad${index}`} className="calendar-pad" />
            ),
          )}
          {monthly.days.map((item) => (
            <button
              key={item.day}
              onClick={() => chooseDay(item.day)}
              className={`calendar-day ${item.events ? 'has-events' : ''} ${item.humanMinutes ? 'has-time' : ''}`}
            >
              <span>{Number(item.day.slice(8))}</span>
              <strong>
                {item.humanMinutes
                  ? hours(item.humanMinutes)
                  : item.events
                    ? 'Tempo não informado'
                    : 'Sem registro'}
              </strong>
              {item.events > 0 && (
                <small>
                  {item.tasks} tarefa{item.tasks > 1 ? 's' : ''}
                </small>
              )}
            </button>
          ))}
        </div>
      </div>
      {monthly.warnings.map((message) => (
        <p className="error" key={message}>
          {message}
        </p>
      ))}
      <div className="notice">
        <Clock3 size={18} />
        <p>
          Estimativas são totais por tarefa e dia, revisáveis pelo agente. Execução de agentes (
          {hours(monthly.totals.agentMinutes)}) e espera ({hours(monthly.totals.waitMinutes)}) ficam
          fora da dedicação humana. Revise tarefas simultâneas para evitar sobreposição.
        </p>
      </div>
    </>
  );
}
