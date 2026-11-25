import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { SettingsStore } from '../src/infrastructure/settings.js';
import { AgentManager } from '../src/infrastructure/agents.js';

test('agent activation preserves other MCP entries and removes only WID, repeatedly', async () => {
  const home = await mkdtemp(join(tmpdir(), 'wid-agent-test-'));
  try {
    await mkdir(join(home, '.codex'));
    const config =
      '# Personal comment\nmodel = "user-model"\n[mcp_servers.existing]\ncommand = "other-server"\n';
    const instructions = '# Existing user instructions\nKeep my rules.\n';
    await writeFile(join(home, '.codex', 'config.toml'), config);
    await writeFile(join(home, '.codex', 'AGENTS.md'), instructions);
    await writeFile(
      join(home, '.claude.json'),
      JSON.stringify({ theme: 'dark', mcpServers: { existing: { command: 'other' } } }),
    );
    const settings = new SettingsStore(join(home, 'data'));
    const manager = new AgentManager(settings, '/test/wid/cli.js', home, '/test/node');
    for (const id of ['codex', 'claude', 'cursor'] as const) {
      await manager.setEnabled(id, true);
      await manager.setEnabled(id, true);
      assert.equal((await settings.read()).agents[id], true);
      await manager.setEnabled(id, false);
      assert.equal((await settings.read()).agents[id], false);
    }
    const after = await readFile(join(home, '.codex', 'config.toml'), 'utf8');
    assert.ok(after.includes('# Personal comment'));
    assert.equal((parse(after).mcp_servers as Record<string, unknown>).existing && true, true);
    assert.ok(!after.includes('wid:begin'));
    assert.equal(
      (await readFile(join(home, '.codex', 'AGENTS.md'), 'utf8')).trim(),
      instructions.trim(),
    );
    const claude = JSON.parse(await readFile(join(home, '.claude.json'), 'utf8'));
    assert.equal(claude.theme, 'dark');
    assert.equal(claude.mcpServers.existing.command, 'other');
    assert.equal(claude.mcpServers.wid, undefined);
    await assert.rejects(
      settings.update((current) => ({ ...current, timezone: 'invalid/timezone' })),
    );
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
test('unowned WID entries are refused without changing global files or state', async () => {
  const home = await mkdtemp(join(tmpdir(), 'wid-conflict-test-'));
  try {
    await mkdir(join(home, '.codex'));
    const config = '[mcp_servers.wid]\ncommand = "someone-else"\n';
    await writeFile(join(home, '.codex', 'config.toml'), config);
    const settings = new SettingsStore(join(home, 'data'));
    const manager = new AgentManager(settings, '/wid/cli.js', home);
    await assert.rejects(manager.setEnabled('codex', true), /não pertence/);
    assert.equal(await readFile(join(home, '.codex', 'config.toml'), 'utf8'), config);
    assert.equal((await settings.read()).agents.codex, false);
    const managedElsewhere =
      '# wid:begin\n[mcp_servers.wid]\ncommand = "node"\nargs = ["/other/wid/cli.js", "mcp"]\n# wid:end\n';
    await writeFile(join(home, '.codex', 'config.toml'), managedElsewhere);
    await assert.rejects(manager.setEnabled('codex', true), /outra instalação/);
    assert.equal(await readFile(join(home, '.codex', 'config.toml'), 'utf8'), managedElsewhere);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
test('optional Claude SessionStart reminder merges and removes just its own hook', async () => {
  const home = await mkdtemp(join(tmpdir(), 'wid-hook-test-'));
  try {
    await mkdir(join(home, '.claude'));
    await writeFile(
      join(home, '.claude', 'settings.json'),
      JSON.stringify({
        hooks: {
          SessionStart: [{ hooks: [{ type: 'command', command: 'existing-hook' }] }],
          Stop: [{ hooks: [{ command: 'stop-hook' }] }],
        },
      }),
    );
    const manager = new AgentManager(
      new SettingsStore(join(home, 'data')),
      '/wid/cli.js',
      home,
      '/node',
    );
    await manager.installClaudeHook(true);
    await manager.installClaudeHook(true);
    let settings = JSON.parse(await readFile(join(home, '.claude', 'settings.json'), 'utf8'));
    assert.equal(settings.hooks.SessionStart.length, 2);
    await manager.installClaudeHook(false);
    settings = JSON.parse(await readFile(join(home, '.claude', 'settings.json'), 'utf8'));
    assert.equal(settings.hooks.SessionStart.length, 1);
    assert.equal(settings.hooks.SessionStart[0].hooks[0].command, 'existing-hook');
    assert.equal(settings.hooks.Stop[0].hooks[0].command, 'stop-hook');
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
