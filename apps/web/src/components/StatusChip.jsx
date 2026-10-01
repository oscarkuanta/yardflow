const TONES = {
  accent: 'bg-soft-accent text-accent-text',
  info: 'bg-soft-info text-info',
  warn: 'bg-soft-warn text-warn',
  danger: 'bg-soft-danger text-danger',
  neutral: 'bg-tile text-muted',
};

export const STATUS_TONES = {
  'In yard': 'info',
  Hold: 'danger',
  Ready: 'accent',
  Expected: 'neutral',
  Departed: 'neutral',
  Denied: 'danger',
  Waiting: 'warn',
};

export function StatusChip({ label, tone = STATUS_TONES[label] ?? 'neutral' }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ${TONES[tone]}`}
    >
      {label}
    </span>
  );
}
