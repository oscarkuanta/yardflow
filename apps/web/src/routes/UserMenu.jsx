import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import { useLogOut } from '../features/auth/auth-hooks.js';
import { ROLE_LABELS, initialsOf } from '../lib/format.js';

export function UserMenu({ user, compact = false }) {
  const logOut = useLogOut();
  const navigate = useNavigate();

  function signOut() {
    logOut.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) });
  }

  return (
    <div className="glass flex items-center gap-1 rounded-full py-1 pl-1 pr-1">
      <span
        aria-hidden="true"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-soft-accent text-xs font-semibold text-accent-text"
      >
        {initialsOf(user.name)}
      </span>
      {!compact && (
        <span className="hidden flex-col px-2 leading-tight xl:flex">
          <span className="text-sm font-medium">{user.name}</span>
          <span className="text-xs text-muted">
            {user.company ? user.company.name : ROLE_LABELS[user.role]}
          </span>
        </span>
      )}
      <ThemeToggle />
      <button
        type="button"
        onClick={signOut}
        disabled={logOut.isPending}
        aria-label="Sign out"
        title="Sign out"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-tile hover:text-ink"
      >
        <LogOut size={18} strokeWidth={1.8} />
      </button>
    </div>
  );
}
