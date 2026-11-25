import { useState, type FormEvent } from 'react';
import { Check, PlugZap, Terminal, ArrowUpRight, Download } from 'lucide-react';
import { api, type Agent, type Settings } from './api';
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
      <div className="section-title">
        <h2>Agentes locais</h2>
        <span className="count">{agents.filter((agent) => agent.enabled).length} ativos</span>
      </div>
      <div className="agent-grid">
        {agents.map((agent) => (
          <article className="agent-card" key={agent.id}>
            <div className="agent-heading">
              <div className={`agent-mark ${agent.id}`}>
                <Terminal size={24} />
              </div>
              <span className={`connection ${agent.detected ? 'detected' : ''}`}>
                <i />
                {agent.detected ? 'Detectado' : 'Não detectado'}
              </span>
            </div>
            <h3>{agent.name}</h3>
            <p className="muted">
              {agent.rules === 'MCP instructions'
                ? 'Orientações fornecidas pelo MCP'
                : 'MCP e instruções globais'}
            </p>
            <div className="agent-details">
              <span>
                <Check size={14} />
                Tarefas e histórico
              </span>
              <span>
                <Check size={14} />
                Estimativa diária de tempo
              </span>
              <span>
                <Check size={14} />
                Relatório mensal
              </span>
            </div>
            <button
              className={agent.enabled ? 'secondary wide' : 'primary wide'}
              disabled={!!busy}
              onClick={() => toggle(agent)}
            >
              {busy === agent.id ? 'Configurando…' : agent.enabled ? 'Desativar WID' : 'Ativar WID'}
              <PlugZap size={16} />
            </button>
          </article>
        ))}
      </div>
      <div className="notice">
        <Terminal size={18} />
        <div>
          <strong>Abra uma nova sessão após ativar.</strong>
          <p>
            O WID adiciona sua entrada MCP e, onde suportado, um bloco de instruções globais. A
            desativação remove apenas a configuração do WID. Hooks de outros programas são
            preservados.
          </p>
        </div>
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
    <div className="settings-layout">
      <form onSubmit={submit} className="panel settings-panel">
        <span className="eyebrow">PREFERÊNCIAS</span>
        <h2>Datas e referências</h2>
        <label>
          Fuso horário
          <input name="timezone" defaultValue={settings.timezone} required />
        </label>
        <label>
          GitHub
          <input
            type="url"
            name="github"
            defaultValue={settings.integrations.github}
            placeholder="https://github.com/seu-usuario"
          />
        </label>
        <label>
          Azure DevOps
          <input
            type="url"
            name="azureDevOps"
            defaultValue={settings.integrations.azureDevOps}
            placeholder="https://dev.azure.com/sua-organizacao"
          />
        </label>
        <p className="field-help">
          Os endereços são atalhos de consulta. Sincronização e autenticação com ferramentas
          externas ainda não fazem parte desta versão.
        </p>
        <button className="primary" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar alterações'}
          <ArrowUpRight size={16} />
        </button>
        {message && (
          <p role="status" className="muted">
            {message}
          </p>
        )}
      </form>
      <aside className="panel settings-panel">
        <span className="eyebrow">DADOS LOCAIS</span>
        <h2>Exportar histórico</h2>
        <p className="muted">Tarefas, eventos, fontes, horários originais e estimativas em JSON.</p>
        <a href="/api/export" download className="secondary">
          <Download size={16} />
          Exportar JSON
        </a>
        <hr />
        <h3>Cobertura parcial</h3>
        <p className="muted">
          Dias sem registros têm tempo desconhecido. Conversas e execução dos agentes não são
          convertidas automaticamente em horas humanas.
        </p>
      </aside>
    </div>
  );
}
