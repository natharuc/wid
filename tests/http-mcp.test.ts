import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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
  await writeFile(join(directory, 'index.html'), '<!doctype html><title>WID test shell</title>');
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
    assert.equal(tools.tools.length, 7);
    const createTool = tools.tools.find((tool) => tool.name === 'wid_create_task')!;
    const contextInput = (
      createTool.inputSchema.properties as Record<string, { type?: string; enum?: unknown }>
    ).context;
    assert.equal(contextInput.type, 'string');
    assert.equal(contextInput.enum, undefined);
    const decode = (result: unknown) =>
      JSON.parse((result as { content: { text: string }[] }).content[0].text);
    const created = decode(
      await client.callTool({
        name: 'wid_create_task',
        arguments: {
          title: 'MCP test',
          references: [
            {
              label: 'Tracking item',
              url: 'https://dev.azure.com/example/project/_workitems/edit/123',
            },
          ],
          idempotencyKey: 'mcp-create',
          sessionId: 'conversation-1',
        },
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
    const other = decode(
      await client.callTool({
        name: 'wid_create_task',
        arguments: {
          title: 'Other context',
          context: 'Pesquisa / Cliente Á',
          idempotencyKey: 'context-create',
        },
      }),
    );
    assert.equal(other.task.context, 'Pesquisa / Cliente Á');
    const groups = decode(await client.callTool({ name: 'wid_list_contexts', arguments: {} }));
    assert.ok(groups.some((group: { name: string }) => group.name === 'Pesquisa / Cliente Á'));
    const isolated = decode(
      await client.callTool({
        name: 'wid_report_month',
        arguments: { month: '2026-11', context: 'Pesquisa / Cliente Á' },
      }),
    );
    assert.equal(isolated.totals.humanMinutes, 0);
    const moved = decode(
      await client.callTool({
        name: 'wid_record_event',
        arguments: {
          taskId: created.task.id,
          kind: 'context_changed',
          context: 'Pesquisa / Cliente Á',
          note: 'Classificação definida pelo agente.',
          idempotencyKey: 'context-move',
        },
      }),
    );
    assert.equal(moved.event.previousContext, 'OUTROS');
    assert.equal(moved.task.id, created.task.id);
    const scoped = decode(
      await client.callTool({
        name: 'wid_report_month',
        arguments: { month: '2026-11', context: 'pesquisa / cliente a' },
      }),
    );
    assert.equal(scoped.totals.humanMinutes, 90);
    const oldScope = decode(
      await client.callTool({
        name: 'wid_report_month',
        arguments: { month: '2026-11', context: 'OUTROS' },
      }),
    );
    assert.equal(oldScope.totals.humanMinutes, 0);
    const viaStdioApi = (await (
      await fetch(
        `${url}/api/agent/codex/snapshot?context=${encodeURIComponent('Pesquisa / Cliente Á')}`,
      )
    ).json()) as { tasks: unknown[] };
    assert.equal(viaStdioApi.tasks.length, 2);
    const filteredExport = (await (await fetch(`${url}/api/export?context=OUTROS`)).json()) as {
      tasks: unknown[];
      events: unknown[];
    };
    assert.equal(filteredExport.tasks.length, 0);
    assert.equal(filteredExport.events.length, 0);
    const addedReference = await client.callTool({
      name: 'wid_record_event',
      arguments: {
        taskId: created.task.id,
        kind: 'references_added',
        references: [{ label: 'Discussion', url: 'https://example.slack.com/archives/C1/p123' }],
        note: 'Existing discussion',
        idempotencyKey: 'add-reference',
      },
    });
    assert.equal(addedReference.isError, undefined);
    const detail = (await (await fetch(`${url}/api/tasks/${created.task.id}`)).json()) as {
      task: { references: unknown[] };
      events: { taskId: string }[];
      totals: { humanMinutes: number };
    };
    assert.equal(detail.task.references.length, 2);
    assert.equal(detail.totals.humanMinutes, 90);
    assert.ok(detail.events.every((event) => event.taskId === created.task.id));
    assert.equal((await fetch(`${url}/api/tasks/${randomUUID()}`)).status, 404);
    assert.equal((await fetch(`${url}/api/tasks/invalid-id`)).status, 400);
    const page = await fetch(`${url}/task/${created.task.id}`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /WID test shell/);
    assert.equal((await fetch(`${url}/tasks`)).status, 200);
    assert.equal((await fetch(`${url}/assets/missing.js`)).status, 404);
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
