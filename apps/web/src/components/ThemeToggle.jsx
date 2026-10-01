import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme.jsx';

export function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-tile hover:text-ink ${className}`}
    >
      <Icon size={18} strokeWidth={1.8} />
    </button>
  );
}
