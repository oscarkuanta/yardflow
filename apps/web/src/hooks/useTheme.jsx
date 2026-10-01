import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyTheme,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  systemTheme,
  watchSystemTheme,
} from '../lib/theme.js';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [stored, setStored] = useState(() => readStoredTheme());
  const [system, setSystem] = useState(() => systemTheme());
  const theme = resolveTheme({ stored, system });

  useEffect(() => watchSystemTheme(setSystem), []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    storeTheme(next);
    setStored(next);
  }, [theme]);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
}
