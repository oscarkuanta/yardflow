(() => {
  function readStoredTheme() {
    try {
      return window.localStorage.getItem('yardflow.theme');
    } catch {
      return null;
    }
  }
  const stored = readStoredTheme();
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const systemTheme = prefersLight ? 'light' : 'dark';
  document.documentElement.dataset.theme =
    stored === 'light' || stored === 'dark' ? stored : systemTheme;
})();
