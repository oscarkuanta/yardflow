import { Bell, Boxes, CalendarClock, Receipt } from 'lucide-react';
import { Suspense } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Skeleton } from '../../components/Skeleton.jsx';
import { useToast } from '../../components/Toasts.jsx';
import { useUnreadCount } from '../../features/portal/portal-api.js';
import { RealtimeProvider, useRealtimeEvent } from '../../lib/realtime.jsx';
import { ResponsiveImage } from '../../components/ResponsiveImage.jsx';
import { useCurrentUser } from '../../features/auth/auth-hooks.js';
import { UserMenu } from '../UserMenu.jsx';

const PORTAL_NAVIGATION = [
  { path: '/portal', label: 'Boxes', icon: Boxes, end: true },
  { path: '/portal/slots', label: 'Slots', icon: CalendarClock },
  { path: '/portal/alerts', label: 'Alerts', icon: Bell },
  { path: '/portal/invoices', label: 'Invoices', icon: Receipt },
];

export function greetingFor(date, timeZone = 'Europe/Berlin') {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(date),
  );
  if (hour < 12) {
    return 'Good morning';
  }
  return hour < 18 ? 'Good afternoon' : 'Good evening';
}

function AlertBell() {
  const unread = useUnreadCount();
  const { showToast } = useToast();
  useRealtimeEvent('notification:new', (notification) => showToast(notification.message));
  return (
    <Link
      to="/portal/alerts"
      aria-label={unread > 0 ? `Alerts, ${unread} unread` : 'Alerts'}
      className="glass relative inline-flex h-12 w-12 items-center justify-center rounded-full"
    >
      <Bell size={18} strokeWidth={1.9} aria-hidden="true" />
      {unread > 0 && (
        <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-[var(--surface)]" />
      )}
    </Link>
  );
}

function PortalNavigation() {
  return (
    <nav
      aria-label="Portal"
      className="glass fixed bottom-4 left-1/2 z-30 w-[calc(100%-2rem)] max-w-[448px] -translate-x-1/2 rounded-full p-1"
    >
      <ul className="grid grid-cols-4">
        {PORTAL_NAVIGATION.map(({ path, label, icon: Icon, end }) => (
          <li key={path}>
            <NavLink
              to={path}
              end={end}
              className={({ isActive }) =>
                `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-full text-xs transition-colors ${
                  isActive ? 'bg-accent font-semibold text-on-accent' : 'text-muted hover:text-ink'
                }`
              }
            >
              <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function PortalShell() {
  const { data: user } = useCurrentUser();
  const firstName = user.name.split(' ')[0];
  return (
    <RealtimeProvider>
      <div className="mx-auto min-h-screen max-w-[480px] bg-bg pb-28">
        <header className="relative h-[330px] overflow-hidden">
          <ResponsiveImage
            name="aerial-cranes"
            alt=""
            sizes="480px"
            eager
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, var(--hero-veil) 0%, var(--bg) 100%)' }}
          />
          <div className="relative flex h-full flex-col justify-between p-4">
            <div className="flex justify-end gap-2">
              <AlertBell />
              <UserMenu user={user} compact />
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-tile bg-accent text-sm font-semibold text-on-accent">
                {user.company.code}
              </span>
              <div>
                <p className="text-sm text-muted">{user.company.name}</p>
                <h1 className="text-[22px] font-semibold">
                  {greetingFor(new Date())}, {firstName}
                </h1>
              </div>
            </div>
          </div>
        </header>
        <main className="animate-fade-in px-4 pt-2">
          <Suspense fallback={<Skeleton className="h-64 rounded-panel" />}>
            <Outlet />
          </Suspense>
        </main>
        <PortalNavigation />
      </div>
    </RealtimeProvider>
  );
}
