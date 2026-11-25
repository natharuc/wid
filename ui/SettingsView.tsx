import { useState, type FormEvent } from 'react';
import { Download, Info, Terminal } from 'lucide-react';
import { api, type Agent, type Settings } from './api';
import { FormField } from './FormField';
export function AgentsView({
  agents,
  reload,
  reportError,
}: {
  agents: Agent[];
  reload: () => Promise<void>;
  reportError: (message: string) => void;
}) {
  const [busy, setBusy] = useState('');
  const toggle = async (agent: Agent) => {
    setBusy(agent.id);
    try {
      const result = await api<{ message: string }>(
        `agents/${agent.id}`,
        { enabled: !agent.enabled },
        'PUT',
      );
      await reload();
      reportError(result.message);
    } catch (error) {
      reportError((error as Error).message);
    } finally {
      setBusy('');
    }
  };
  return (
    <>
      <section className="card bg-base-100 border border-base-300">
        <div className="card-body p-4 sm:p-6">
          <div className="flex justify-between items-center">
            <h2 className="card-title text-base">Agentes locais</h2>
            <span className="badge badge-ghost">
              {agents.filter((agent) => agent.enabled).length} ativos
            </span>
          </div>
          <ul className="list">
            {agents.map((agent) => (
              <li className="list-row items-center px-0" key={agent.id}>
                <div className="avatar avatar-placeholder">
                  <div className="bg-base-200 text-base-content rounded-box w-10">
                    <Terminal size={20} />
                  </div>
                </div>
                <div className="list-col-grow">
                  <h3 className="font-semibold">{agent.name}</h3>
                  <p className="text-xs text-base-content/60 mt-1">
                    {agent.rules === 'MCP instructions'
                      ? 'Orientações fornecidas pelo MCP'
                      : 'MCP e instruções globais'}
                  </p>
                  <span className="badge badge-ghost badge-xs mt-2">
                    {agent.detected ? 'Detectado' : 'Não detectado'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-base-content/60 hidden sm:inline">
                    {agent.enabled ? 'Ativo' : 'Inativo'}
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    className="toggle toggle-primary"
                    aria-label={`Ativar WID no ${agent.name}`}
                    checked={agent.enabled}
                    disabled={!!busy}
                    onChange={() => {
                      void toggle(agent);
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <div className="alert alert-info alert-soft">
        <Info size={20} />
        <p className="text-sm">
          Abra uma nova sessão após ativar. O WID configura sua entrada MCP e, quando suportado, as
          instruções globais. A desativação remove apenas a integração do WID.
        </p>
      </div>
    </>
  );
}
export function SettingsView({
  settings,
  onSaved,
}: {
  settings: Settings;
  onSaved: () => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await api(
        'settings',
        {
          timezone: form.get('timezone'),
          integrations: { github: form.get('github'), azureDevOps: form.get('azureDevOps') },
        },
        'PUT',
      );
      await onSaved();
      setMessage('Configurações salvas.');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <section className="card border border-base-300 bg-base-100 xl:col-span-2">
        <form onSubmit={submit} className="card-body p-4 sm:p-6 gap-4">
          <h2 className="card-title text-base">Datas e referências</h2>
          <FormField label="Fuso horário">
            <input
              className="input w-full"
              name="timezone"
              defaultValue={settings.timezone}
              required
            />
          </FormField>
          <FormField label="GitHub">
            <input
              className="input w-full"
              type="url"
              name="github"
              defaultValue={settings.integrations.github}
              placeholder="https://github.com/seu-usuario"
            />
          </FormField>
          <FormField label="Azure DevOps">
            <input
              className="input w-full"
              type="url"
              name="azureDevOps"
              defaultValue={settings.integrations.azureDevOps}
              placeholder="https://dev.azure.com/sua-organizacao"
            />
          </FormField>
          <p className="text-xs text-base-content/60">
            Os endereços são atalhos de consulta. Esta versão não sincroniza dados com essas
            ferramentas.
          </p>
          <div className="card-actions mt-3">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
          {message && (
            <div className="alert alert-soft text-sm" role="status">
              {message}
            </div>
          )}
        </form>
      </section>
      <aside className="card border border-base-300 bg-base-100">
        <div className="card-body p-4 sm:p-6 gap-4">
          <h2 className="card-title text-base">Exportar histórico</h2>
          <p className="text-sm text-base-content/60">
            Tarefas, eventos, fontes, horários e estimativas em JSON.
          </p>
          <a href="/api/export" download className="btn btn-outline">
            <Download size={16} />
            Exportar JSON
          </a>
          <div className="divider my-1" />
          <h3 className="font-medium text-sm">Cobertura parcial</h3>
          <p className="text-sm text-base-content/60">
            Dias sem registros têm tempo desconhecido. Execução de agentes e espera ficam fora das
            horas humanas.
          </p>
        </div>
      </aside>
    </div>
  );
}
