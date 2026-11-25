import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { defaultDataDir, agentIds } from './infrastructure/settings.js';
import { rules } from './infrastructure/agent-rules.js';
import { composition, ensureServer, isHealthy, runServer, serviceUrl } from './runtime.js';
import { runStdio } from './interface/stdio.js';

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      'data-dir': { type: 'string' },
      agent: { type: 'string' },
      background: { type: 'boolean' },
      disable: { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  const directory = resolve(values['data-dir'] ?? defaultDataDir());
  const [command = 'start', target] = positionals;
  const { settings, agents } = composition(directory);
  if (values.help || command === 'help')
    return console.log(
      `wid — what I did?\n\nwid start [--background]   Local dashboard and MCP\nwid setup                Detect agents; no automatic config writes\nwid agent <codex|claude|cursor> [--disable]\nwid hook-install claude [--disable]  Optional SessionStart reminder\nwid mcp --agent <id>      MCP stdio; starts local server if needed\nwid report [YYYY-MM]     Recorded human time and coverage\nwid status\nwid stop\n\n--data-dir <path>         Persistent data directory\nWID_DATABASE_URL         Optional external PostgreSQL database\nNo network exposure, telemetry or transcript collection.`,
    );
  switch (command) {
    case 'setup':
      await settings.update((current) => current);
      console.table(await agents.list());
      console.log('Use wid agent <id> or the dashboard to activate WID.');
      break;
    case 'start':
      if (values.background) console.log(await ensureServer(directory));
      else await runServer(directory);
      break;
    case 'agent': {
      const id = z.enum(agentIds).parse(target);
      await agents.setEnabled(id, !values.disable);
      if (id === 'claude' && values.disable) await agents.installClaudeHook(false);
      console.log(`${id}: ${values.disable ? 'disabled' : 'enabled'}. Open a new agent session.`);
      break;
    }
    case 'hook-install':
      if (target !== 'claude') throw new Error('Only Claude Code SessionStart is supported.');
      await agents.installClaudeHook(!values.disable);
      console.log(`Claude SessionStart reminder ${values.disable ? 'removed' : 'installed'}.`);
      break;
    case 'hook': {
      if (target !== 'claude') throw new Error('Unknown hook.');
      const active = (await settings.read()).agents.claude;
      console.log(
        JSON.stringify(
          active
            ? { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: rules } }
            : {},
        ),
      );
      break;
    }
    case 'mcp':
      await runStdio(directory, z.enum(agentIds).parse(values.agent));
      break;
    case 'report': {
      const url = await ensureServer(directory);
      const timezone = (await settings.read()).timezone;
      const month =
        target ??
        new Intl.DateTimeFormat('sv-SE', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
        }).format(new Date());
      const response = await fetch(`${url}/api/month/${encodeURIComponent(month)}`);
      if (!response.ok) throw new Error('Use YYYY-MM for the report month.');
      console.log(JSON.stringify(await response.json(), null, 2));
      break;
    }
    case 'status':
      console.log({
        url: await serviceUrl(directory),
        running: await isHealthy(await serviceUrl(directory), directory),
        directory,
      });
      break;
    case 'stop': {
      const url = await serviceUrl(directory);
      if (!(await isHealthy(url, directory))) return console.log('WID is not running for this data directory.');
      await fetch(`${url}/api/shutdown`, { method: 'POST', headers: { 'X-WID-Client': 'wid' } });
      console.log('WID stopped.');
      break;
    }
    default:
      throw new Error('Unknown command. Use wid --help.');
  }
}
main().catch((error) => {
  console.error(
    error instanceof z.ZodError
      ? error.issues.map((issue) => issue.message).join('; ')
      : (error as Error).message,
  );
  process.exitCode = 1;
});
