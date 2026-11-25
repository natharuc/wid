import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'business');
  const changeTheme = (enabled: boolean) => {
    const theme = enabled ? 'business' : 'corporate';
    document.documentElement.dataset.theme = theme;
    setDark(enabled);
    try {
      localStorage.setItem('wid.theme', theme);
    } catch {
      // Keep the current page usable when browser storage is unavailable.
    }
  };
  return (
    <button
      type="button"
      role="switch"
      aria-label="Modo escuro"
      aria-checked={dark}
      className="btn btn-ghost btn-square"
      title="Alternar modo escuro"
      onClick={() => changeTheme(!dark)}
    >
      {dark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
    </button>
  );
}
