import { useState, type FormEvent } from 'react';
import { Download, Info } from 'lucide-react';
import { api, type Agent, type Settings } from './api';
import { FormField } from './FormField';
import { useWorkContext } from './WorkContext';
import { contextQuery } from './context-scope';
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
            <h2 className="card-title text-base">Local agents</h2>
            <span className="badge badge-ghost">
              {agents.filter((agent) => agent.enabled).length} enabled
            </span>
          </div>
          <ul className="list">
            {agents.map((agent) => (
              <li className="list-row items-center px-0" key={agent.id}>
                <div className="avatar">
                  <div className="bg-white border border-base-300 rounded-box w-12 h-12 p-2">
                    <img
                      src={`/agents/${agent.id}.svg`}
                      alt={`Logo: ${agent.name}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
                <div className="list-col-grow">
                  <h3 className="font-semibold">{agent.name}</h3>
                  <p className="text-xs text-base-content/60">{agent.description}</p>
                  <p className="text-xs text-base-content/60 mt-1">
                    {agent.rules === 'MCP instructions'
                      ? 'Instructions provided by MCP'
                      : 'MCP and global instructions'}
                  </p>
                  <span className="badge badge-ghost badge-xs mt-2">
                    {agent.detected ? 'Detected' : 'Not detected'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-base-content/60 hidden sm:inline">
                    {agent.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    className="toggle toggle-primary"
                    aria-label={`Enable WID for ${agent.name}`}
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
          Open a new session after enabling an agent. WID configures its MCP entry and, where
          supported, global instructions. Disabling removes only the WID integration. Agent
          activation applies to all contexts.
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
  const { context } = useWorkContext();
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
        },
        'PUT',
      );
      await onSaved();
      setMessage('Settings saved.');
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
          <h2 className="card-title text-base">Time zone</h2>
          <FormField label="Time zone">
            <input
              className="input w-full"
              name="timezone"
              defaultValue={settings.timezone}
              required
            />
          </FormField>
          <p className="text-xs text-base-content/60">
            The time zone applies to all contexts. Tools and links are recorded on each task.
          </p>
          <div className="card-actions mt-3">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
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
          <h2 className="card-title text-base">Export history</h2>
          <p className="text-sm text-base-content/60">
            Tasks, events, sources, timestamps and estimates in JSON.
          </p>
          <a href={`/api/export${contextQuery(context)}`} download className="btn btn-outline">
            <Download size={16} />
            Export JSON
          </a>
          <div className="divider my-1" />
          <h3 className="font-medium text-sm">Partial coverage</h3>
          <p className="text-sm text-base-content/60">
            Days without records have unknown work time. Agent runtime and waiting are excluded from
            human work time.
          </p>
        </div>
      </aside>
    </div>
  );
}
