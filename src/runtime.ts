import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { WorkService } from './application/work-service.js';
import { openDatabase, migrate } from './infrastructure/database.js';
import { SqlWorkStore } from './infrastructure/work-store.js';
import { SettingsStore, readOptional } from './infrastructure/settings.js';
import { AgentManager } from './infrastructure/agents.js';
import { createApp } from './interface/http.js';

export const cliPath = fileURLToPath(new URL('./cli.js', import.meta.url));
export function composition(directory: string) {
  const settings = new SettingsStore(directory);
  return { settings, agents: new AgentManager(settings, cliPath) };
}
export async function serviceUrl(directory: string) {
  return `http://127.0.0.1:${(await new SettingsStore(directory).read()).port}`;
}
function instanceId(directory: string) {
  const normalized =
    process.platform === 'win32' ? resolve(directory).toLowerCase() : resolve(directory);
  return createHash('sha256').update(normalized).digest('hex').slice(0, 24);
}
export async function isHealthy(url: string, directory?: string) {
  try {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(700) });
    const result = (await response.json()) as { service?: string; instanceId?: string };
    return (
      response.ok &&
      result.service === 'wid' &&
      (!directory || result.instanceId === instanceId(directory))
    );
  } catch {
    return false;
  }
}
export async function runServer(directory: string) {
  await mkdir(directory, { recursive: true });
  const lock = join(directory, 'service.lock');
  try {
    await mkdir(lock);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const owner = Number(await readOptional(join(lock, 'pid')));
    if (owner) {
      try {
        process.kill(owner, 0);
        throw new Error('WID is already starting or running in this directory.');
      } catch (check) {
        if ((check as NodeJS.ErrnoException).code !== 'ESRCH') throw check;
      }
    } else
      throw new Error(
        'WID startup is in progress. If it was interrupted, remove service.lock only after confirming that WID is not running.',
      );
    await rm(lock, { recursive: true });
    await mkdir(lock);
  }
  await writeFile(join(lock, 'pid'), String(process.pid));
  let database: Awaited<ReturnType<typeof openDatabase>> | undefined;
  try {
    const { settings, agents } = composition(directory);
    const config = await settings.read();
    database = await openDatabase(join(directory, 'postgres'), process.env.WID_DATABASE_URL);
    await migrate(database);
    const work = new WorkService(
      new SqlWorkStore(database),
      undefined,
      async () => (await settings.read()).timezone,
    );
    let closing = false;
    const close = async () => {
      if (closing) return;
      closing = true;
      const drained = new Promise<void>((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      );
      server.closeIdleConnections();
      await drained;
      await database!.close();
      await rm(lock, { recursive: true });
      process.exitCode = 0;
    };
    const app = createApp({
      work,
      settings,
      agents,
      instanceId: instanceId(directory),
      webPath: fileURLToPath(new URL('../web/', import.meta.url)),
      onShutdown: () => {
        void close();
      },
    });
    const server = app.listen(config.port, '127.0.0.1');
    await new Promise<void>((done, reject) => {
      server.once('listening', done);
      server.once('error', reject);
    });
    process.once('SIGINT', () => {
      void close();
    });
    process.once('SIGTERM', () => {
      void close();
    });
    console.log(`WID http://127.0.0.1:${config.port}\nData: ${directory}`);
  } catch (error) {
    await database?.close();
    await rm(lock, { recursive: true });
    throw error;
  }
}
export async function ensureServer(directory: string) {
  const url = await serviceUrl(directory);
  if (await isHealthy(url, directory)) return url;
  if (await isHealthy(url))
    throw new Error(
      'Another WID data directory is using this port. Stop that instance or configure a different port in settings.json.',
    );
  if (cliPath.endsWith('.ts'))
    throw new Error('Run npm run build before starting in the background.');
  const child = spawn(process.execPath, [cliPath, 'start', '--data-dir', resolve(directory)], {
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
    env: process.env,
  });
  let failure: Error | undefined;
  child.on('error', (error) => {
    failure = error;
  });
  child.unref();
  for (let attempt = 0; attempt < 80; attempt++) {
    if (failure) throw failure;
    if (await isHealthy(url, directory)) return url;
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(
    'WID did not start. Run wid start in the foreground to diagnose the issue; check the port and data directory.',
  );
}
