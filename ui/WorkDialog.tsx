import { useRef, useEffect, useState, type FormEvent } from 'react';
import { X, ArrowUpRight } from 'lucide-react';
import { api, statusLabel, type Task } from './api';

export function WorkDialog({
  task,
  day,
  onClose,
  onSaved,
}: {
  task?: Task;
  day: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState('progressed');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      if (task) {
        await api('events', {
          taskId: task.id,
          kind,
          note: data.get('note'),
          idempotencyKey: crypto.randomUUID(),
          ...(kind === 'corrected' ? { correctsEventId: data.get('correctsEventId') } : {}),
          ...(['effort', 'corrected'].includes(kind) && data.get('minutes') !== ''
            ? {
                effort: {
                  category: data.get('category'),
                  day: data.get('day'),
                  minutes: Number(data.get('minutes')),
                  confidence: data.get('confidence'),
                },
              }
            : {}),
        });
      } else {
        const url = String(data.get('reference') ?? '').trim();
        await api('tasks', {
          title: data.get('title'),
          company: data.get('company'),
          project: data.get('project'),
          note: data.get('note') || undefined,
          references: url ? [{ label: 'Referência', url }] : [],
          idempotencyKey: crypto.randomUUID(),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog ref={dialog} onCancel={onClose} className="work-dialog">
      <div className="dialog-head">
        <span className="eyebrow">{task ? 'ATUALIZAR TAREFA' : 'NOVA TAREFA'}</span>
        <button className="icon-btn" aria-label="Fechar" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <h2>{task?.title ?? 'O que você vai fazer?'}</h2>
      {task && (
        <p className="muted">
          {statusLabel[task.status]} · {task.project || 'Sem projeto'}
        </p>
      )}
      <form onSubmit={submit}>
        {!task ? (
          <>
            <label>
              Tarefa
              <input
                name="title"
                required
                maxLength={240}
                autoFocus
                placeholder="Ex.: Revisar o fluxo de autenticação"
              />
            </label>
            <div className="form-grid">
              <label>
                Empresa
                <input name="company" maxLength={100} placeholder="Opcional" />
              </label>
              <label>
                Projeto
                <input name="project" maxLength={120} placeholder="Opcional" />
              </label>
            </div>
            <label>
              Referência
              <input name="reference" placeholder="Link de chat, Task, issue ou PR (opcional)" />
            </label>
          </>
        ) : (
          <label>
            Tipo de registro
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="progressed">Avanço</option>
              <option value="started">Iniciar trabalho</option>
              <option value="effort">Registrar tempo do dia</option>
              <option value="decided">Decisão</option>
              <option value="blocked">Bloqueio</option>
              <option value="completed">Concluir</option>
              <option value="cancelled">Cancelar</option>
              <option value="corrected">Corrigir um registro</option>
            </select>
          </label>
        )}
        {kind === 'corrected' && task && (
          <label>
            ID do evento original
            <input name="correctsEventId" required placeholder="Consulte o ID na linha do tempo" />
          </label>
        )}
        {task && ['effort', 'corrected'].includes(kind) && (
          <div className="effort-fields">
            <div className="form-grid">
              <label>
                Dia
                <input type="date" name="day" defaultValue={day} required />
              </label>
              <label>
                Total no dia (minutos)
                <input
                  type="number"
                  name="minutes"
                  min={0}
                  max={1440}
                  step="1"
                  required
                  defaultValue=""
                />
              </label>
            </div>
            <label>
              Natureza do tempo
              <select name="category">
                <option value="human_estimated">Dedicação humana estimada</option>
                <option value="human_measured">Dedicação humana medida / informada</option>
                <option value="agent_run">Execução do agente</option>
                <option value="wait">Espera / job</option>
              </select>
            </label>
            <label>
              Confiança da estimativa
              <select name="confidence" defaultValue="medium">
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </label>
            <p className="field-help">
              Informe o total acumulado desta tarefa no dia. O novo valor substitui o anterior da
              mesma categoria. Tempo medido já está incluído na estimativa total.
            </p>
          </div>
        )}
        <label>
          {kind === 'effort' ? 'Evidências e premissas da estimativa' : 'Descrição'}
          <textarea
            name="note"
            rows={3}
            required={!!task}
            maxLength={4000}
            placeholder={
              kind === 'effort'
                ? 'O que sustenta esse tempo? Informe a fonte e as incertezas.'
                : 'Descreva a intenção, o avanço ou a decisão.'
            }
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary wide" disabled={busy}>
          {busy ? 'Salvando…' : task ? 'Salvar registro' : 'Criar tarefa'}
          <ArrowUpRight size={17} />
        </button>
      </form>
    </dialog>
  );
}
