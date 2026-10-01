import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StackIndicator } from '../../components/StackIndicator.jsx';
import { STATUS_TONES, StatusChip } from '../../components/StatusChip.jsx';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../auth/auth-api.js';

function DemoInvitation() {
  return (
    <div className="flex flex-col justify-between gap-6 rounded-panel bg-accent p-6 text-on-accent">
      <div className="flex flex-col gap-3">
        <h2 className="text-[22px] font-semibold leading-tight">
          Sign in with a demo role and run a full import in 2 minutes
        </h2>
        <p className="text-sm">
          Every demo account uses the password{' '}
          <span className="numeric rounded-md bg-black/10 px-1.5 py-0.5">{DEMO_PASSWORD}</span>
        </p>
      </div>
      <Link
        to="/login"
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-control bg-on-accent px-5 font-semibold text-accent"
      >
        Open live demo
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </div>
  );
}

function DemoAccounts() {
  return (
    <div className="panel flex flex-col gap-3 p-5">
      <h2 className="text-base font-semibold">Demo accounts</h2>
      <ul className="flex flex-col gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <li key={account.email}>
            <Link
              to={`/login?email=${encodeURIComponent(account.email)}`}
              className="flex min-h-12 items-center justify-between gap-3 rounded-tile bg-tile px-3 py-2 transition-colors hover:bg-soft-accent"
            >
              <span className="flex flex-col">
                <span className="text-sm font-medium">{account.label}</span>
                <span className="numeric text-xs text-muted">{account.email}</span>
              </span>
              <ArrowRight size={16} className="text-muted" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusLegend() {
  return (
    <div className="panel flex flex-col gap-4 p-5">
      <h2 className="text-base font-semibold">Every status at a glance</h2>
      <ul className="flex flex-wrap gap-2">
        {Object.keys(STATUS_TONES).map((label) => (
          <li key={label}>
            <StatusChip label={label} />
          </li>
        ))}
      </ul>
      <div className="flex items-end gap-4 rounded-tile bg-tile p-4">
        <StackIndicator height={2} maxTier={5} />
        <p className="text-sm text-muted">
          Stacks show the next free tier in accent, so planners see at once where the next box goes.
        </p>
      </div>
    </div>
  );
}

export function DemoSection() {
  return (
    <section aria-label="Try the demo" className="mx-auto max-w-7xl px-4 md:px-8">
      <div className="grid gap-4 md:grid-cols-3">
        <DemoInvitation />
        <DemoAccounts />
        <StatusLegend />
      </div>
    </section>
  );
}
