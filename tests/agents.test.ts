import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { SettingsStore } from '../src/infrastructure/settings.js';
import { AgentManager } from '../src/infrastructure/agents.js';
import { agentPaths } from '../src/infrastructure/agent-catalog.js';
import { parse as parseJsonc } from 'jsonc-parser';

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
    await assert.rejects(manager.setEnabled('codex', true), /does not belong/);
    assert.equal(await readFile(join(home, '.codex', 'config.toml'), 'utf8'), config);
    assert.equal((await settings.read()).agents.codex, false);
    const managedElsewhere =
      '# wid:begin\n[mcp_servers.wid]\ncommand = "node"\nargs = ["/other/wid/cli.js", "mcp"]\n# wid:end\n';
    await writeFile(join(home, '.codex', 'config.toml'), managedElsewhere);
    await assert.rejects(manager.setEnabled('codex', true), /another installation/);
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

test('Copilot, Gemini and OpenCode configurations preserve JSONC, other servers and ownership', async () => {
  const home = await mkdtemp(join(tmpdir(), 'wid-market-agents-'));
  const settings = new SettingsStore(join(home, 'data'));
  const manager = new AgentManager(settings, '/wid/cli.js', home, '/node');
  try {
    for (const id of ['copilot', 'gemini', 'opencode'] as const) {
      const paths = await agentPaths(id, home);
      await mkdir(paths.directory, { recursive: true });
      const source =
        id === 'opencode'
          ? '{\n // Keep this comment\n "model":"example/model", "mcp":{"servers":{"existing":{"type":"local","command":["other"]}}},\n}'
          : '{\n // Keep this comment\n "theme":"dark", "mcpServers":{"existing":{"command":"other"}},\n}';
      await writeFile(paths.config, source);
      await manager.setEnabled(id, true);
      await manager.setEnabled(id, true);
      const enabled = await readFile(paths.config, 'utf8');
      assert.match(enabled, /Keep this comment/);
      const parsed = parseJsonc(enabled);
      const servers = id === 'opencode' ? parsed.mcp.servers : parsed.mcpServers;
      const entry = servers.wid;
      assert.ok(servers.existing);
      assert.equal((await settings.read()).agents[id], true);
      if (id === 'opencode')
        assert.deepEqual(entry.command, [
          '/node',
          '/wid/cli.js',
          'mcp',
          '--agent',
          id,
          '--data-dir',
          settings.directory,
        ]);
      else assert.equal(entry.args[3], id);
      if (id === 'copilot') {
        assert.equal(entry.type, 'local');
        assert.deepEqual(entry.tools, ['*']);
      }
      await manager.setEnabled(id, false);
      const disabled = await readFile(paths.config, 'utf8');
      assert.match(disabled, /Keep this comment/);
      assert.equal(
        (id === 'opencode' ? parseJsonc(disabled).mcp.servers : parseJsonc(disabled).mcpServers)
          .wid,
        undefined,
      );
      assert.equal((await settings.read()).agents[id], false);
      const conflict =
        id === 'opencode'
          ? '{"mcp":{"servers":{"wid":{"type":"local","command":["other"]}}}}'
          : '{"mcpServers":{"wid":{"command":"other"}}}';
      await writeFile(paths.config, conflict);
      await assert.rejects(manager.setEnabled(id, true), /another installation/);
      assert.equal(await readFile(paths.config, 'utf8'), conflict);
    }
    assert.equal((await manager.list()).length, 6);
    const paths = await agentPaths('opencode', home);
    await writeFile(paths.config, '{"mcp":{"existing":{"type":"local","command":["other"]}}}');
    await assert.rejects(manager.setEnabled('opencode', true), /OpenCode 2/);
    const copilot = await agentPaths('copilot', home);
    await writeFile(copilot.config, '{ invalid json');
    await assert.rejects(manager.setEnabled('copilot', true), /Invalid/);
    assert.equal(await readFile(copilot.config, 'utf8'), '{ invalid json');
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
