import express from 'express';
import { resolve } from 'node:path';
import { z, ZodError } from 'zod';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { WorkService } from '../application/work-service.js';
import {
  contextSchema,
  daySchema,
  monthReport,
  sourceSchema,
  summarize,
  WorkError,
} from '../domain/work.js';
import { agentIds, type AgentId, type SettingsStore } from '../infrastructure/settings.js';
import type { AgentManager } from '../infrastructure/agents.js';
import { makeMcp, type WorkGateway } from './mcp.js';
import { VERSION } from '../version.js';
import { makeWorkDigest } from '../domain/work-digest.js';

export function createApp(options: {
  work: WorkService;
  settings: SettingsStore;
  agents: AgentManager;
  webPath: string;
  onShutdown?: () => void;
  instanceId?: string;
}) {
  const { work, settings, agents } = options;
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const allowed = new Set([
      `127.0.0.1:${req.socket.localPort}`,
      `localhost:${req.socket.localPort}`,
    ]);
    if (!allowed.has(req.headers.host ?? ''))
      return res.status(403).json({ error: 'Localhost host required' });
    const origin = req.headers.origin;
    if (origin && ![...allowed].some((host) => origin === `http://${host}`))
      return res.status(403).json({ error: 'Cross-origin requests are not allowed' });
    if (req.headers['sec-fetch-site'] === 'cross-site')
      return res.status(403).json({ error: 'Cross-site requests are not allowed' });
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use(express.json({ limit: '128kb' }));
  app.get('/health', (_req, res) =>
    res.json({ service: 'wid', version: VERSION, instanceId: options.instanceId }),
  );
  const gateway: WorkGateway = {
    create: (input, source) => work.create(input, source),
    record: (input, source) => work.record(input, source),
    snapshot: (context) => work.snapshot(context),
    contexts: () => work.contexts(),
    day: async (day, context) => {
      const snapshot = await work.snapshot(context);
      const timezone = (await settings.read()).timezone;
      const parsedDay = daySchema.parse(day);
      return {
        context: context ?? null,
        ...summarize(snapshot.events, parsedDay, timezone),
        digest: makeWorkDigest(snapshot.tasks, snapshot.events, parsedDay, timezone),
        taskDetails: snapshot.tasks,
      };
    },
    month: async (month, context) => {
      const snapshot = await work.snapshot(context);
      return {
        context: context ?? null,
        ...monthReport(snapshot.events, month, (await settings.read()).timezone),
        tasks: snapshot.tasks,
      };
    },
  };
  const enabled = async (agent: string) => {
    if (!agentIds.includes(agent as AgentId) || !(await settings.read()).agents[agent as AgentId])
      throw new WorkError('Agente desativado no WID.', 403);
  };
  app.all('/mcp/:agent', async (req, res) => {
    await enabled(String(req.params.agent));
    const server = makeMcp(gateway, String(req.params.agent));
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD'].includes(req.method) && req.headers['x-wid-client'] !== 'wid')
      return res.status(403).json({ error: 'WID client header required' });
    next();
  });
  const queryContext = (req: express.Request) => contextSchema.optional().parse(req.query.context);
  app.get('/api/contexts', async (_req, res) => res.json(await work.contexts()));
  app.get('/api/snapshot', async (req, res) => res.json(await work.snapshot(queryContext(req))));
  app.get('/api/tasks/:id', async (req, res) =>
    res.json(
      await work.detail(
        z.string().uuid().parse(req.params.id),
        (await settings.read()).timezone,
        queryContext(req),
      ),
    ),
  );
  app.get('/api/day/:day', async (req, res) =>
    res.json(await gateway.day(req.params.day, queryContext(req))),
  );
  app.get('/api/month/:month', async (req, res) =>
    res.json(await gateway.month(req.params.month, queryContext(req))),
  );
  app.get('/api/export', async (req, res) => {
    const context = queryContext(req);
    res.setHeader('Content-Disposition', 'attachment; filename="wid-export.json"');
    res.json({
      format: 'wid/v1',
      exportedAt: new Date().toISOString(),
      timezone: (await settings.read()).timezone,
      context: context ?? null,
      ...(await work.snapshot(context)),
    });
  });
  app.post('/api/tasks', async (req, res) =>
    res.status(201).json(await work.create(req.body, { agent: 'dashboard' })),
  );
  app.post('/api/events', async (req, res) =>
    res.status(201).json(await work.record(req.body, { agent: 'dashboard' })),
  );
  app.get('/api/settings', async (_req, res) => res.json(await settings.read()));
  app.put('/api/settings', async (req, res) => {
    const input = z
      .object({
        timezone: z.string().optional(),
      })
      .strict()
      .parse(req.body);
    res.json(await settings.update((current) => ({ ...current, ...input })));
  });
  app.get('/api/agents', async (_req, res) => res.json(await agents.list()));
  app.put('/api/agents/:agent', async (req, res) => {
    const id = z.enum(agentIds).parse(req.params.agent);
    const input = z.object({ enabled: z.boolean() }).parse(req.body);
    await agents.setEnabled(id, input.enabled);
    if (id === 'claude' && !input.enabled) await agents.installClaudeHook(false);
    res.json({
      agents: await agents.list(),
      message: 'Abra uma nova sessão do agente para carregar a configuração.',
    });
  });
  // The stdio adapter uses the same application service and keeps a single database owner.
  app.use('/api/agent/:agent', async (req, _res, next) => {
    await enabled(String(req.params.agent));
    next();
  });
  app.get('/api/agent/:agent/contexts', async (_req, res) => res.json(await work.contexts()));
  app.get('/api/agent/:agent/snapshot', async (req, res) =>
    res.json(await work.snapshot(queryContext(req))),
  );
  app.get('/api/agent/:agent/day/:day', async (req, res) =>
    res.json(await gateway.day(req.params.day, queryContext(req))),
  );
  app.get('/api/agent/:agent/month/:month', async (req, res) =>
    res.json(await gateway.month(req.params.month, queryContext(req))),
  );
  app.post('/api/agent/:agent/tasks', async (req, res) =>
    res.json(
      await work.create(
        req.body.input,
        sourceSchema.parse({ ...req.body.source, agent: req.params.agent }),
      ),
    ),
  );
  app.post('/api/agent/:agent/events', async (req, res) =>
    res.json(
      await work.record(
        req.body.input,
        sourceSchema.parse({ ...req.body.source, agent: req.params.agent }),
      ),
    ),
  );
  app.post('/api/shutdown', (_req, res) => {
    res.json({ stopped: true });
    setTimeout(() => options.onShutdown?.(), 50);
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint não encontrado.' }));
  app.get(['/tasks', '/month', '/agents', '/settings', '/task/:id'], (_req, res) =>
    res.sendFile(resolve(options.webPath, 'index.html')),
  );
  app.use(express.static(resolve(options.webPath)));
  app.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (error instanceof ZodError)
        return res.status(400).json({
          error: error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; '),
        });
      if (error instanceof WorkError)
        return res.status(error.status).json({ error: error.message });
      if (error instanceof SyntaxError) return res.status(400).json({ error: 'JSON inválido.' });
      // Never expose SQL, connection strings, local configuration contents or submitted data.
      console.error('WID operation failed:', error instanceof Error ? error.name : 'UnknownError');
      res.status(500).json({ error: 'Falha local. Confira a configuração e tente novamente.' });
    },
  );
  return app;
}
