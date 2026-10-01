import { Link } from 'react-router-dom';

export function LogoMark({ className = 'h-7 w-7' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <rect x="7" y="17" width="8" height="7" rx="1.5" fill="var(--on-accent)" />
      <rect x="17" y="17" width="8" height="7" rx="1.5" fill="var(--on-accent)" />
      <rect x="12" y="8" width="8" height="7" rx="1.5" fill="var(--on-accent)" />
    </svg>
  );
}

export function Logo({ to = '/' }) {
  return (
    <Link to={to} className="flex items-center gap-2 font-semibold tracking-heading text-ink">
      <LogoMark />
      <span className="text-base">YardFlow</span>
    </Link>
  );
}
