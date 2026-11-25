import { Moon, Sun } from 'lucide-react';

export function ThemeToggle({
  dark,
  onChange,
}: {
  dark: boolean;
  onChange: (dark: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label="Dark mode"
      aria-checked={dark}
      className="btn btn-ghost btn-square"
      title="Toggle dark mode"
      onClick={() => onChange(!dark)}
    >
      {dark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
    </button>
  );
}
