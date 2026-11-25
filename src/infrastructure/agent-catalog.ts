import { access, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AgentId } from './settings.js';

export const agentCatalog: Record<AgentId, { name: string; description: string }> = {
  codex: { name: 'Codex', description: 'App and CLI' },
  claude: { name: 'Claude Code', description: 'Terminal and extensions' },
  cursor: { name: 'Cursor', description: 'Editor' },
  copilot: { name: 'GitHub Copilot', description: 'CLI and VS Code Copilot harness' },
  gemini: { name: 'Gemini CLI', description: 'Terminal' },
  opencode: { name: 'OpenCode', description: 'Version 2 · terminal and app' },
};
export async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
export async function hasCopilotExtension(home: string): Promise<boolean> {
  try {
    return (await readdir(join(home, '.vscode', 'extensions'))).some((name) =>
      /^github\.copilot(?:-chat)?-\d/i.test(name),
    );
  } catch {
    return false;
  }
}
export async function agentPaths(
  id: AgentId,
  home: string,
): Promise<{
  config: string;
  directory: string;
  rules?: string;
  serverPath: string[];
  conflict?: string;
}> {
  const standard = ['mcpServers', 'wid'];
  if (id === 'codex') {
    const directory =
      process.env.CODEX_HOME && home === homedir() ? process.env.CODEX_HOME : join(home, '.codex');
    return {
      directory,
      config: join(directory, 'config.toml'),
      rules: join(directory, 'AGENTS.md'),
      serverPath: [],
    };
  }
  if (id === 'claude')
    return {
      directory: join(home, '.claude'),
      config: join(home, '.claude.json'),
      rules: join(home, '.claude', 'CLAUDE.md'),
      serverPath: standard,
    };
  if (id === 'cursor')
    return {
      directory: join(home, '.cursor'),
      config: join(home, '.cursor', 'mcp.json'),
      serverPath: standard,
    };
  if (id === 'copilot') {
    const directory =
      process.env.COPILOT_HOME && home === homedir()
        ? process.env.COPILOT_HOME
        : join(home, '.copilot');
    return { directory, config: join(directory, 'mcp-config.json'), serverPath: standard };
  }
  if (id === 'gemini')
    return {
      directory: join(home, '.gemini'),
      config: join(home, '.gemini', 'settings.json'),
      serverPath: standard,
    };
  const directory = join(home, '.config', 'opencode');
  const json = join(directory, 'opencode.json'),
    jsonc = join(directory, 'opencode.jsonc');
  return {
    directory,
    config: (await exists(jsonc)) ? jsonc : json,
    serverPath: ['mcp', 'servers', 'wid'],
    conflict:
      (await exists(json)) && (await exists(jsonc))
        ? 'OpenCode: both opencode.json and opencode.jsonc exist. Consolidate the configuration before enabling WID.'
        : undefined,
  };
}
