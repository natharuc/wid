import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { parse } from 'smol-toml';
import { WorkError } from '../domain/work.js';
import {
  agentIds,
  atomicWrite,
  readOptional,
  type AgentId,
  type SettingsStore,
} from './settings.js';
import { ruleBlock } from './agent-rules.js';
import { agentCatalog, agentPaths, exists, hasCopilotExtension } from './agent-catalog.js';
import { editServerConfig } from './json-agent-config.js';

const tomlMarker = /\n?# wid:begin\r?\n[\s\S]*?# wid:end\r?\n?/g;
const ruleMarker = /\n?<!-- wid:begin -->\r?\n[\s\S]*?<!-- wid:end -->\r?\n?/g;
export class AgentManager {
  constructor(
    private readonly settings: SettingsStore,
    private readonly cliPath: string,
    private readonly home = homedir(),
    private readonly nodePath = process.execPath,
  ) {}
  async list() {
    const settings = await this.settings.read();
    return Promise.all(
      agentIds.map(async (id) => {
        const paths = await agentPaths(id, this.home);
        const installed =
          (await exists(paths.config)) ||
          (await exists(paths.directory)) ||
          (id === 'copilot' && (await hasCopilotExtension(this.home))) ||
          (await this.onPath(id === 'claude' ? 'claude' : id));
        return {
          id,
          ...agentCatalog[id],
          detected: installed,
          enabled: settings.agents[id],
          rules: paths.rules ? 'Global instructions' : 'MCP instructions',
          hook: id === 'claude' ? 'SessionStart (opt-in CLI)' : null,
          configPath: paths.config,
        };
      }),
    );
  }
  async setEnabled(id: AgentId, enabled: boolean) {
    return this.settings.update(async (settings) => {
      const paths = await agentPaths(id, this.home);
      if (paths.conflict) throw new WorkError(paths.conflict, 409);
      const original = await readOptional(paths.config);
      const entry = {
        command: this.nodePath,
        args: [this.cliPath, 'mcp', '--agent', id, '--data-dir', this.settings.directory],
      };
      let updated: string;
      if (id === 'codex') {
        const prior = (
          parse(original || '').mcp_servers as Record<string, { args?: unknown[] }> | undefined
        )?.wid;
        if (original.includes('# wid:begin') && prior && !this.ownedEntry(prior))
          throw new WorkError('A wid entry from another installation already exists.', 409);
        const clean = original.replace(tomlMarker, '');
        const parsed = parse(clean || '');
        if ((parsed.mcp_servers as Record<string, unknown> | undefined)?.wid)
          throw new WorkError(
            'A wid MCP entry that does not belong to this installation already exists. Preserve or rename that entry.',
            409,
          );
        updated = enabled
          ? `${clean.trimEnd()}\n\n# wid:begin\n[mcp_servers.wid]\ncommand = ${JSON.stringify(entry.command)}\nargs = ${JSON.stringify(entry.args)}\n# wid:end\n`
          : clean;
        parse(updated);
      } else {
        const configured =
          id === 'copilot'
            ? { ...entry, type: 'local', tools: ['*'] }
            : id === 'opencode'
              ? { type: 'local', command: [entry.command, ...entry.args] }
              : entry;
        updated = editServerConfig(
          original,
          paths.serverPath,
          enabled ? configured : undefined,
          (value) => this.ownedEntry(value),
        );
      }
      const changes = [{ path: paths.config, before: original, after: updated }];
      if (paths.rules) {
        const before = await readOptional(paths.rules);
        const clean = before.replace(ruleMarker, '');
        changes.push({
          path: paths.rules,
          before,
          after: enabled ? `${clean.trimEnd()}\n\n${ruleBlock}\n` : clean,
        });
      }
      await this.applyChanges(changes.filter((change) => change.before !== change.after));
      settings.agents[id] = enabled;
      return settings;
    });
  }
  async installClaudeHook(enabled: boolean) {
    const path = join(this.home, '.claude', 'settings.json');
    const before = await readOptional(path);
    const parsed = before ? JSON.parse(before) : {};
    const command = `"${this.nodePath}" "${this.cliPath}" hook claude`;
    parsed.hooks ??= {};
    const existing = parsed.hooks.SessionStart ?? [];
    const clean = existing.filter(
      (item: { hooks?: { command?: string }[] }) =>
        !item.hooks?.some((hook) => hook.command === command),
    );
    parsed.hooks.SessionStart = enabled
      ? [
          ...clean,
          { matcher: 'startup|resume|compact', hooks: [{ type: 'command', command, timeout: 5 }] },
        ]
      : clean;
    await this.applyChanges([{ path, before, after: JSON.stringify(parsed, null, 2) + '\n' }]);
  }
  private ownedEntry(value: unknown) {
    if (!value || typeof value !== 'object') return false;
    const entry = value as { args?: unknown[]; command?: unknown };
    return (
      entry.args?.[0] === this.cliPath ||
      (Array.isArray(entry.command) && entry.command[1] === this.cliPath)
    );
  }
  private async onPath(name: string) {
    for (const directory of (process.env.PATH ?? '').split(
      process.platform === 'win32' ? ';' : ':',
    )) {
      for (const extension of process.platform === 'win32'
        ? ['.exe', '.cmd', '.ps1', '.bat']
        : [''])
        if (await exists(join(directory, name + extension))) return true;
    }
    return false;
  }
  private async applyChanges(changes: { path: string; before: string; after: string }[]) {
    const applied: typeof changes = [];
    try {
      for (const change of changes) {
        if ((await readOptional(change.path)) !== change.before)
          throw new WorkError('Configuration changed by another process. Try again.', 409);
        await mkdir(dirname(change.path), { recursive: true });
        await atomicWrite(change.path, change.after);
        applied.push(change);
      }
    } catch (error) {
      for (const change of applied.reverse()) await atomicWrite(change.path, change.before);
      throw error;
    }
  }
}
