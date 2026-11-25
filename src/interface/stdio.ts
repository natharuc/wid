import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ensureServer } from '../runtime.js';
import { makeMcp } from './mcp.js';
import type { Source } from '../domain/work.js';
export async function runStdio(directory: string, agent: string) {
  const url = await ensureServer(directory);
  async function request(path: string, body?: unknown) {
    const response = await fetch(`${url}/api/agent/${agent}/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'X-WID-Client': 'wid' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(result.error ?? 'WID request failed');
    return result;
  }
  const server = makeMcp(
    {
      create: (input: unknown, source: Source) => request('tasks', { input, source }),
      record: (input: unknown, source: Source) => request('events', { input, source }),
      snapshot: (context) =>
        request(`snapshot${context ? `?context=${encodeURIComponent(context)}` : ''}`),
      day: (day, context) =>
        request(`day/${day}${context ? `?context=${encodeURIComponent(context)}` : ''}`),
      month: (month, context) =>
        request(`month/${month}${context ? `?context=${encodeURIComponent(context)}` : ''}`),
      contexts: () => request('contexts'),
    },
    agent,
  );
  await server.connect(new StdioServerTransport());
}
