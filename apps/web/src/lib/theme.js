export const THEME_STORAGE_KEY = 'yardflow.theme';
export const THEMES = ['dark', 'light'];
const LIGHT_QUERY = '(prefers-color-scheme: light)';

export function readStoredTheme(storage = globalThis.localStorage) {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY);
    return THEMES.includes(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme, storage = globalThis.localStorage) {
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    return;
  }
}

export function systemTheme(matchMedia = globalThis.matchMedia) {
  return matchMedia?.(LIGHT_QUERY).matches ? 'light' : 'dark';
}

export function resolveTheme({ stored, system }) {
  return stored ?? system;
}

export function applyTheme(theme, root = document.documentElement) {
  root.dataset.theme = theme;
}

export function watchSystemTheme(onChange, matchMedia = globalThis.matchMedia) {
  const query = matchMedia?.(LIGHT_QUERY);
  if (!query?.addEventListener) {
    return () => {};
  }
  const listener = (event) => onChange(event.matches ? 'light' : 'dark');
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
