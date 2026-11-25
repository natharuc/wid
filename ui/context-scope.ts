export const CONTEXT_STORAGE_KEY = 'wid.context';
export function selectedContext(search: string, saved: string | null): string {
  const query = new URLSearchParams(search);
  return (query.has('context') ? (query.get('context') ?? '') : (saved ?? '')).trim();
}
export function scopedPath(path: string, context: string): string {
  const url = new URL(path, 'http://wid.local');
  url.searchParams.set('context', context);
  return `${url.pathname}${url.search}${url.hash}`;
}
export const contextQuery = (context: string) =>
  context ? `?context=${encodeURIComponent(context)}` : '';
