import { useState, type ReactNode } from 'react';
import {
  ArrowUpRight,
  Bot,
  CalendarDays,
  CheckSquare2,
  CircleDot,
  LayoutList,
  Menu,
  Plus,
  Settings2,
  X,
} from 'lucide-react';
export type Page = 'day' | 'tasks' | 'month' | 'agents' | 'settings';
const navigation = [
  { id: 'day', title: 'Visão diária', icon: LayoutList },
  { id: 'tasks', title: 'Tarefas', icon: CheckSquare2 },
  { id: 'month', title: 'Relatório mensal', icon: CalendarDays },
  { id: 'agents', title: 'Agentes', icon: Bot },
  { id: 'settings', title: 'Configurações', icon: Settings2 },
] as const;
export function Shell({
  page,
  setPage,
  taskCount,
  timezone,
  newTask,
  children,
}: {
  page: Page;
  setPage: (page: Page) => void;
  taskCount: number;
  timezone: string;
  newTask: () => void;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const title = navigation.find((item) => item.id === page)!.title;
  const navigate = (value: Page) => {
    setPage(value);
    setMenuOpen(false);
  };
  return (
    <div className="drawer lg:drawer-open">
      <input
        id="navigation"
        type="checkbox"
        className="drawer-toggle"
        checked={menuOpen}
        onChange={(event) => setMenuOpen(event.target.checked)}
        aria-label="Menu de navegação"
      />
      <div className="drawer-content min-w-0 min-h-screen bg-base-200">
        <header className="navbar border-b border-base-300 bg-base-100 px-4 md:px-8 gap-3">
          <button
            className="btn btn-square btn-ghost lg:hidden"
            aria-label="Abrir menu"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs text-sm flex-1">
            <ul>
              <li>Meu trabalho</li>
              <li className="font-medium">{title}</li>
            </ul>
          </div>
          <span className="text-xs text-base-content/60 hidden sm:block">{timezone}</span>
          <span className="badge badge-outline gap-2">
            <span className="status status-success" />
            Local
          </span>
        </header>
        <main className="mx-auto max-w-screen-2xl p-4 md:p-8 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold">{title}</h1>
            <button className="btn btn-primary" onClick={newTask}>
              <Plus size={18} />
              Nova tarefa
            </button>
          </div>
          {children}
        </main>
      </div>
      <aside className="drawer-side z-40">
        <label htmlFor="navigation" aria-label="Fechar menu" className="drawer-overlay" />
        <div className="flex min-h-full w-60 flex-col border-r border-base-300 bg-base-100">
          <div className="flex items-center justify-between px-6 py-6">
            <a
              href="/"
              aria-label="WID início"
              className="flex items-center gap-2 text-xl font-bold"
            >
              <CheckSquare2 className="text-primary" size={25} />
              wid
            </a>
            <button
              className="btn btn-ghost btn-square btn-sm lg:hidden"
              aria-label="Fechar menu"
              onClick={() => setMenuOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <nav aria-label="Principal" className="px-3">
            <ul className="menu w-full gap-1">
              {navigation.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => navigate(item.id)}
                    className={page === item.id ? 'menu-active' : ''}
                    aria-current={page === item.id ? 'page' : undefined}
                  >
                    <item.icon size={18} />
                    {item.title}
                    {item.id === 'tasks' && (
                      <span className="badge badge-sm badge-ghost ml-auto">{taskCount}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-auto p-5 space-y-3 text-xs text-base-content/60">
            <div className="flex items-center gap-2">
              <CircleDot size={13} className="text-success" />
              PostgreSQL local
            </div>
            <a
              href="https://github.com/natharuc/wid"
              target="_blank"
              rel="noreferrer"
              className="link link-hover inline-flex items-center gap-2"
            >
              natharuc/wid
              <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}
