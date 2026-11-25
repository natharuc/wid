import { useState } from 'react';

export function useTheme() {
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
  return { dark, changeTheme };
}
