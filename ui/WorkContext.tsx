import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { CONTEXT_STORAGE_KEY, scopedPath, selectedContext } from './context-scope';

interface WorkScope {
  context: string;
  href: (path: string) => string;
  select: (context: string) => void;
}
const WorkContext = createContext<WorkScope | undefined>(undefined);
function remember(context: string) {
  try {
    localStorage.setItem(CONTEXT_STORAGE_KEY, context);
  } catch {
    /* URL preserves scope without storage. */
  }
}
export function WorkContextProvider({ children }: { children: ReactNode }) {
  const [context] = useState(() => {
    let saved = null;
    try {
      saved = localStorage.getItem(CONTEXT_STORAGE_KEY);
    } catch {
      /* Use explicit URL or overall view. */
    }
    return selectedContext(window.location.search, saved);
  });
  useEffect(() => {
    remember(context);
  }, [context]);
  const select = (next: string) => {
    remember(next);
    const path = window.location.pathname.startsWith('/task/')
      ? '/tasks'
      : `${window.location.pathname}${window.location.search}`;
    window.location.assign(scopedPath(path, next));
  };
  return (
    <WorkContext.Provider value={{ context, select, href: (path) => scopedPath(path, context) }}>
      {children}
    </WorkContext.Provider>
  );
}
export function useWorkContext(): WorkScope {
  const scope = useContext(WorkContext);
  if (!scope) throw new Error('WorkContextProvider required');
  return scope;
}
