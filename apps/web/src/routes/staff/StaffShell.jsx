import { Search } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { LogoMark } from '../../components/Logo.jsx';
import { useCurrentUser } from '../../features/auth/auth-hooks.js';
import { UserMenu } from '../UserMenu.jsx';
import { navigationFor } from './staff-navigation.js';

function navItemClasses({ isActive }) {
  return [
    'flex h-10 items-center gap-2 rounded-full px-3.5 text-sm transition-colors',
    isActive ? 'bg-accent font-semibold text-on-accent' : 'text-muted hover:text-ink',
  ].join(' ');
}

function StaffNavigation({ role }) {
  return (
    <nav aria-label="Staff" className="glass rounded-full p-1">
      <ul className="flex items-center gap-0.5">
        {navigationFor(role).map(({ path, label, icon: Icon, end }) => (
          <li key={path}>
            <NavLink to={path} end={end} className={navItemClasses} title={label}>
              {({ isActive }) => (
                <>
                  <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
                  <span className={isActive ? 'inline' : 'sr-only lg:not-sr-only'}>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SearchPill() {
  return (
    <label className="glass hidden h-12 min-w-0 flex-1 items-center gap-2 rounded-full px-4 text-muted md:flex">
      <Search size={16} aria-hidden="true" />
      <span className="sr-only">Search</span>
      <input
        type="search"
        placeholder="Container, vessel or plate"
        className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
      />
    </label>
  );
}

export function StaffShell() {
  const { data: user } = useCurrentUser();
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 px-3 pt-3 md:px-4">
        <div className="flex items-center gap-2">
          <span className="glass inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
            <LogoMark className="h-7 w-7" />
            <span className="sr-only">YardFlow</span>
          </span>
          <div className="min-w-0 overflow-x-auto">
            <StaffNavigation role={user.role} />
          </div>
          <SearchPill />
          <div className="ml-auto shrink-0">
            <UserMenu user={user} />
          </div>
        </div>
      </header>
      <p className="mx-3 mt-3 rounded-tile bg-soft-warn px-4 py-2 text-xs text-warn sm:hidden">
        The staff screens are designed for desktop and tablet. On a phone they stay readable, but
        some panels are cramped.
      </p>
      <main className="animate-fade-in px-3 pb-10 pt-4 md:px-4">
        <Outlet />
      </main>
    </div>
  );
}
