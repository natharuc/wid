export const pagePaths = {
  day: '/',
  tasks: '/tasks',
  month: '/month',
  agents: '/agents',
  settings: '/settings',
} as const;
export type Page = keyof typeof pagePaths | 'task';
export function pageFromPath(path: string): Page {
  if (/^\/task\/[^/]+\/?$/.test(path)) return 'task';
  return (Object.entries(pagePaths).find(
    ([, value]) => value === path.replace(/\/$/, '') || (value === '/' && path === '/'),
  )?.[0] ?? 'day') as Page;
}
export const taskPath = (id: string) => `/task/${encodeURIComponent(id)}`;
