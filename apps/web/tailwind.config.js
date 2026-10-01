function token(name) {
  return `var(--${name})`;
}

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        glass: token('surface-glass'),
        tile: token('surface-2'),
        line: token('border'),
        ink: token('text'),
        muted: token('text-muted'),
        accent: token('accent'),
        'accent-text': token('accent-text'),
        'on-accent': token('on-accent'),
        info: token('info'),
        warn: token('warn'),
        danger: token('danger'),
        'soft-accent': token('soft-accent'),
        'soft-info': token('soft-info'),
        'soft-warn': token('soft-warn'),
        'soft-danger': token('soft-danger'),
      },
      fontFamily: {
        sans: ['Sora', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        control: '12px',
        tile: '16px',
        panel: '20px',
      },
      boxShadow: {
        float: token('shadow-float'),
      },
      letterSpacing: {
        heading: '-0.03em',
        display: '-0.045em',
      },
    },
  },
  plugins: [],
};
