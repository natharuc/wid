import { access, mkdir, readFile } from 'node:fs/promises';
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

const tomlMarker = /\n?# wid:begin\r?\n[\s\S]*?# wid:end\r?\n?/g;
const ruleMarker = /\n?<!-- wid:begin -->\r?\n[\s\S]*?<!-- wid:end -->\r?\n?/g;
async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
export class AgentManager {
  constructor(
    private readonly settings: SettingsStore,
    private readonly cliPath: string,
    private readonly home = homedir(),
    private readonly nodePath = process.execPath,
  ) {}
  private paths(id: AgentId) {
    const codex =
      process.env.CODEX_HOME && this.home === homedir()
        ? process.env.CODEX_HOME
        : join(this.home, '.codex');
    if (id === 'codex')
      return {
        config: join(codex, 'config.toml'),
        rules: join(codex, 'AGENTS.md'),
        directory: codex,
      };
    if (id === 'claude')
      return {
        config: join(this.home, '.claude.json'),
        rules: join(this.home, '.claude', 'CLAUDE.md'),
        directory: join(this.home, '.claude'),
      };
    return {
      config: join(this.home, '.cursor', 'mcp.json'),
      directory: join(this.home, '.cursor'),
    };
  }
  async list() {
    const settings = await this.settings.read();
    return Promise.all(
      agentIds.map(async (id) => {
        const paths = this.paths(id);
        const installed =
          (await exists(paths.config)) ||
          (await exists(paths.directory)) ||
          (await this.onPath(id === 'claude' ? 'claude' : id));
        return {
          id,
          name: { codex: 'Codex', claude: 'Claude Code', cursor: 'Cursor' }[id],
          detected: installed,
          enabled: settings.agents[id],
          rules: id === 'cursor' ? 'MCP instructions' : 'Global instructions',
          hook: id === 'claude' ? 'SessionStart (opt-in CLI)' : null,
          configPath: paths.config,
        };
      }),
    );
  }
  async setEnabled(id: AgentId, enabled: boolean) {
    return this.settings.update(async (settings) => {
      const paths = this.paths(id);
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
          throw new WorkError('Já existe uma entrada wid de outra instalação.', 409);
        const clean = original.replace(tomlMarker, '');
        const parsed = parse(clean || '');
        if ((parsed.mcp_servers as Record<string, unknown> | undefined)?.wid)
          throw new WorkError(
            'Já existe um MCP wid que não pertence a esta instalação. Preserve ou renomeie essa entrada.',
            409,
          );
        updated = enabled
          ? `${clean.trimEnd()}\n\n# wid:begin\n[mcp_servers.wid]\ncommand = ${JSON.stringify(entry.command)}\nargs = ${JSON.stringify(entry.args)}\n# wid:end\n`
          : clean;
        parse(updated);
      } else {
        const parsed = original ? JSON.parse(original) : {};
        const previous = parsed.mcpServers?.wid;
        if (previous && !this.ownedEntry(previous))
          throw new WorkError('Já existe uma entrada wid de outra instalação.', 409);
        parsed.mcpServers ??= {};
        if (enabled) parsed.mcpServers.wid = entry;
        else delete parsed.mcpServers.wid;
        updated = JSON.stringify(parsed, null, 2) + '\n';
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
      await this.applyChanges(changes);
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
  private ownedEntry(entry: { args?: unknown[] }) {
    return entry.args?.[0] === this.cliPath;
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
          throw new WorkError('Configuração alterada por outro processo. Tente novamente.', 409);
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
