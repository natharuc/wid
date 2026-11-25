import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { request } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { openDatabase, migrate } from '../src/infrastructure/database.js';
import { SettingsStore } from '../src/infrastructure/settings.js';
import { AgentManager } from '../src/infrastructure/agents.js';
import { SqlWorkStore } from '../src/infrastructure/work-store.js';
import { WorkService } from '../src/application/work-service.js';
import { createApp } from '../src/interface/http.js';

test('real MCP roundtrip, cumulative day/month totals, agent gate and localhost protection', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'wid-http-test-'));
  const db = await openDatabase(join(directory, 'pg'));
  await migrate(db);
  const settings = new SettingsStore(directory);
  await settings.update((current) => ({ ...current, agents: { ...current.agents, codex: true } }));
  const app = createApp({
    work: new WorkService(new SqlWorkStore(db), () => '2026-11-25T15:00:00Z'),
    settings,
    agents: new AgentManager(settings, '/wid/cli.js', directory),
    webPath: directory,
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((done) => server.once('listening', done));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const client = new Client({ name: 'wid-test', version: '1.0.0' });
  try {
    assert.equal(
      (
        await fetch(`${url}/api/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(`${url}/api/snapshot`, { headers: { Origin: 'https://evil.example' } })).status,
      403,
    );
    const badHost = await new Promise<number | undefined>((done, reject) => {
      const req = request(`${url}/health`, { headers: { Host: 'evil.example' } }, (response) => {
        response.resume();
        done(response.statusCode);
      });
      req.on('error', reject);
      req.end();
    });
    assert.equal(badHost, 403);
    await client.connect(new StreamableHTTPClientTransport(new URL(`${url}/mcp/codex`)));
    const tools = await client.listTools();
    assert.equal(tools.tools.length, 6);
    const decode = (result: unknown) =>
      JSON.parse((result as { content: { text: string }[] }).content[0].text);
    const created = decode(
      await client.callTool({
        name: 'wid_create_task',
        arguments: { title: 'MCP test', idempotencyKey: 'mcp-create', sessionId: 'conversation-1' },
      }),
    );
    assert.equal(created.event.source.agent, 'codex');
    for (const minutes of [40, 90]) {
      const result = await client.callTool({
        name: 'wid_estimate_day',
        arguments: {
          taskId: created.task.id,
          day: '2026-11-25',
          minutes,
          basis: 'Conversation indicates work, excluding long tool wait.',
          confidence: 'medium',
          idempotencyKey: `estimate-${minutes}`,
        },
      });
      assert.equal(result.isError, undefined);
    }
    const monthly = decode(
      await client.callTool({ name: 'wid_report_month', arguments: { month: '2026-11' } }),
    );
    assert.equal(monthly.totals.humanMinutes, 90);
    assert.equal(monthly.totals.estimatedMinutes, 90);
    assert.equal(monthly.coveredDays, 1);
    const daily = decode(
      await client.callTool({ name: 'wid_report_day', arguments: { day: '2026-11-25' } }),
    );
    assert.equal(daily.tasks, 1);
    assert.equal(daily.humanMinutes, 90);
    assert.equal(daily.taskDetails[0].title, 'MCP test');
    const exported = (await (await fetch(`${url}/api/export`)).json()) as {
      events: unknown[];
      format: string;
    };
    assert.equal(exported.format, 'wid/v1');
    assert.equal(exported.events.length, 3);
    await settings.update((current) => ({
      ...current,
      agents: { ...current.agents, codex: false },
    }));
    assert.equal((await fetch(`${url}/api/agent/codex/snapshot`)).status, 403);
    assert.equal(
      (
        await fetch(`${url}/mcp/codex`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      ).status,
      403,
    );
    assert.equal((await fetch(`${url}/api/does-not-exist`)).status, 404);
    assert.equal(
      (
        await fetch(`${url}/api/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-WID-Client': 'wid' },
          body: JSON.stringify({ title: 'API task', idempotencyKey: randomUUID() }),
        })
      ).status,
      201,
    );
  } finally {
    await client.close();
    await new Promise<void>((done, reject) =>
      server.close((error) => (error ? reject(error) : done())),
    );
    await db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
