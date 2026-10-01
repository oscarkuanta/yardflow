import { RequireAuth } from '../features/auth/RequireAuth.jsx';
import { STAFF_ROLES } from '../features/auth/auth-api.js';
import { LandingPage } from '../features/landing/LandingPage.jsx';
import { LoginPage } from '../features/login/LoginPage.jsx';
import { NotFoundPage } from '../routes/NotFoundPage.jsx';
import { PortalShell } from '../routes/portal/PortalShell.jsx';
import {
  PortalAlertsPage,
  PortalBoxesPage,
  PortalInvoicesPage,
  PortalSlotsPage,
} from '../routes/portal/portal-pages.jsx';
import { StaffShell } from '../routes/staff/StaffShell.jsx';
import {
  AdminPage,
  CustomsPage,
  GatePage,
  ReportsPage,
  VesselsPage,
  WorkOrdersPage,
  YardOverviewPage,
} from '../routes/staff/staff-pages.jsx';
import { STAFF_NAVIGATION } from '../routes/staff/staff-navigation.js';

const STAFF_PAGES = {
  '/app': YardOverviewPage,
  '/app/gate': GatePage,
  '/app/vessels': VesselsPage,
  '/app/work-orders': WorkOrdersPage,
  '/app/customs': CustomsPage,
  '/app/reports': ReportsPage,
  '/app/admin': AdminPage,
};

function staffChildRoute({ path, roles }) {
  const Page = STAFF_PAGES[path];
  const element = (
    <RequireAuth roles={roles}>
      <Page />
    </RequireAuth>
  );
  return path === '/app' ? { index: true, element } : { path: path.replace('/app/', ''), element };
}

export const routes = [
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/app',
    element: (
      <RequireAuth roles={STAFF_ROLES}>
        <StaffShell />
      </RequireAuth>
    ),
    children: STAFF_NAVIGATION.map(staffChildRoute),
  },
  {
    path: '/portal',
    element: (
      <RequireAuth roles={['CUSTOMER']}>
        <PortalShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <PortalBoxesPage /> },
      { path: 'slots', element: <PortalSlotsPage /> },
      { path: 'alerts', element: <PortalAlertsPage /> },
      { path: 'invoices', element: <PortalInvoicesPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];
