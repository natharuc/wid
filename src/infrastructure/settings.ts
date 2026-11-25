import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
export const agentIds = ['codex', 'claude', 'cursor'] as const;
export type AgentId = (typeof agentIds)[number];
export const settingsSchema = z.object({
  port: z.number().int().min(1024).max(65535).default(4318),
  timezone: z
    .string()
    .default('America/Sao_Paulo')
    .refine((value) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }),
  agents: z
    .object({
      codex: z.boolean().default(false),
      claude: z.boolean().default(false),
      cursor: z.boolean().default(false),
    })
    .prefault({}),
  integrations: z
    .object({
      github: z.string().url().or(z.literal('')).default(''),
      azureDevOps: z.string().url().or(z.literal('')).default(''),
    })
    .prefault({}),
});
export type Settings = z.infer<typeof settingsSchema>;
export function defaultDataDir() {
  return (
    process.env.WID_DATA_DIR ??
    join(process.env.LOCALAPPDATA ?? join(homedir(), '.local', 'share'), 'wid')
  );
}
export async function readOptional(path: string) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
}
export async function atomicWrite(path: string, content: string) {
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, content, { mode: 0o600 });
    await rename(temp, path);
  } finally {
    await rm(temp, { force: true });
  }
}
export class SettingsStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly directory: string) {}
  async read(): Promise<Settings> {
    const content = await readOptional(join(this.directory, 'settings.json'));
    return settingsSchema.parse(content ? JSON.parse(content) : {});
  }
  async update(action: (settings: Settings) => Promise<Settings> | Settings) {
    const next = this.queue.then(async () => {
      await mkdir(this.directory, { recursive: true });
      const settings = settingsSchema.parse(await action(await this.read()));
      await atomicWrite(
        join(this.directory, 'settings.json'),
        JSON.stringify(settings, null, 2) + '\n',
      );
      return settings;
    });
    this.queue = next.catch(() => {});
    return next;
  }
}
