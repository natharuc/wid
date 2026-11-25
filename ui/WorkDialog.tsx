import { useRef, useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { api, statusLabel, type Task } from './api';
import { FormField } from './FormField';
const recordTypes = [
  ['progressed', 'Avanço'],
  ['started', 'Iniciar trabalho'],
  ['effort', 'Registrar tempo do dia'],
  ['decided', 'Decisão'],
  ['blocked', 'Bloqueio'],
  ['completed', 'Concluir'],
  ['cancelled', 'Cancelar'],
  ['corrected', 'Corrigir um registro'],
] as const;
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
  const closed = task && ['completed', 'cancelled'].includes(task.status);
  const [kind, setKind] = useState(closed ? 'decided' : 'progressed');
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
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="work-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="modal-box max-w-xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 id="work-title" className="text-lg font-semibold">
              {task?.title ?? 'Nova tarefa'}
            </h2>
            {task && (
              <p className="text-sm text-base-content/60 mt-1">
                {statusLabel[task.status]} · {task.project || 'Sem projeto'}
              </p>
            )}
          </div>
          <button
            className="btn btn-ghost btn-sm btn-square shrink-0"
            aria-label="Fechar"
            disabled={busy}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {!task ? (
            <>
              <FormField label="Tarefa">
                <input
                  className="input w-full"
                  name="title"
                  required
                  maxLength={240}
                  autoFocus
                  placeholder="Ex.: Revisar autenticação"
                />
              </FormField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Empresa">
                  <input
                    className="input w-full"
                    name="company"
                    maxLength={100}
                    placeholder="Opcional"
                  />
                </FormField>
                <FormField label="Projeto">
                  <input
                    className="input w-full"
                    name="project"
                    maxLength={120}
                    placeholder="Opcional"
                  />
                </FormField>
              </div>
              <FormField label="Referência">
                <input
                  className="input w-full"
                  name="reference"
                  placeholder="Link de chat, Task, issue ou PR"
                />
              </FormField>
            </>
          ) : (
            <FormField label="Tipo de registro">
              <select
                className="select w-full"
                value={kind}
                onChange={(event) => setKind(event.target.value)}
              >
                {recordTypes.map(([value, label]) => (
                  <option
                    key={value}
                    value={value}
                    disabled={
                      !!closed &&
                      ['started', 'progressed', 'blocked', 'completed', 'cancelled'].includes(value)
                    }
                  >
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
          )}
          {task && kind === 'corrected' && (
            <FormField label="ID do evento original">
              <input
                className="input w-full"
                name="correctsEventId"
                required
                placeholder="Consulte os detalhes do histórico"
              />
            </FormField>
          )}
          {task && ['effort', 'corrected'].includes(kind) && <EffortFields day={day} />}
          <FormField
            label={kind === 'effort' ? 'Evidências e premissas da estimativa' : 'Descrição'}
          >
            <textarea
              className="textarea w-full"
              name="note"
              rows={3}
              required={!!task}
              maxLength={4000}
              placeholder={
                kind === 'effort'
                  ? 'Informe a fonte e as incertezas da estimativa.'
                  : 'Descreva a intenção, o avanço ou a decisão.'
              }
            />
          </FormField>
          {error && (
            <div className="alert alert-error alert-soft text-sm" role="alert">
              {error}
            </div>
          )}
          <div className="modal-action">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>
              Voltar
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy && <span className="loading loading-spinner loading-xs" />}
              {busy ? 'Salvando…' : task ? 'Salvar registro' : 'Criar tarefa'}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" disabled={busy} onClick={onClose}>
          Fechar diálogo
        </button>
      </form>
    </dialog>
  );
}
function EffortFields({ day }: { day: string }) {
  return (
    <fieldset className="fieldset border border-base-300 rounded-box p-4 gap-3">
      <legend className="fieldset-legend">Tempo da tarefa no dia</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Dia">
          <input className="input w-full" type="date" name="day" defaultValue={day} required />
        </FormField>
        <FormField label="Total no dia (minutos)">
          <input
            className="input w-full"
            type="number"
            name="minutes"
            min={0}
            max={1440}
            step="1"
            required
          />
        </FormField>
      </div>
      <FormField label="Natureza do tempo">
        <select className="select w-full" name="category">
          <option value="human_estimated">Dedicação humana estimada</option>
          <option value="human_measured">Dedicação humana medida / informada</option>
          <option value="agent_run">Execução do agente</option>
          <option value="wait">Espera / job</option>
        </select>
      </FormField>
      <FormField label="Confiança da estimativa">
        <select className="select w-full" name="confidence" defaultValue="medium">
          <option value="low">Baixa</option>
          <option value="medium">Média</option>
          <option value="high">Alta</option>
        </select>
      </FormField>
      <p className="text-xs text-base-content/60">
        Total acumulado desta tarefa no dia. O novo valor substitui o anterior da mesma categoria. A
        estimativa total inclui o tempo já medido.
      </p>
    </fieldset>
  );
}
