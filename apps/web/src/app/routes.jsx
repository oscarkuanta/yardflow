import { lazy } from 'react';
import { RequireAuth } from '../features/auth/RequireAuth.jsx';
import { STAFF_ROLES } from '../features/auth/auth-api.js';
import { LandingPage } from '../features/landing/LandingPage.jsx';
import { LoginPage } from '../features/login/LoginPage.jsx';
import { NotFoundPage } from '../routes/NotFoundPage.jsx';
import { PortalShell } from '../routes/portal/PortalShell.jsx';
import { StaffShell } from '../routes/staff/StaffShell.jsx';

import { STAFF_NAVIGATION } from '../routes/staff/staff-navigation.js';

function lazyPage(load, exportName) {
  return lazy(() => load().then((module) => ({ default: module[exportName] })));
}

const YardOverviewPage = lazyPage(
  () => import('../features/yard/YardOverviewPage.jsx'),
  'YardOverviewPage',
);
const GatePage = lazyPage(() => import('../features/gate/GatePage.jsx'), 'GatePage');
const VesselsPage = lazyPage(() => import('../features/vessels/VesselsPage.jsx'), 'VesselsPage');
const VesselDetailPage = lazyPage(
  () => import('../features/vessels/VesselDetailPage.jsx'),
  'VesselDetailPage',
);
const WorkOrdersPage = lazyPage(
  () => import('../features/work-orders/WorkOrdersPage.jsx'),
  'WorkOrdersPage',
);
const CustomsPage = lazyPage(() => import('../features/customs/CustomsPage.jsx'), 'CustomsPage');
const BillingPage = lazyPage(() => import('../features/billing/BillingPage.jsx'), 'BillingPage');
const ReportsPage = lazyPage(() => import('../features/reports/ReportsPage.jsx'), 'ReportsPage');
const AdminPage = lazyPage(() => import('../features/admin/AdminPage.jsx'), 'AdminPage');

const PortalBoxesPage = lazyPage(
  () => import('../features/portal/PortalBoxesPage.jsx'),
  'PortalBoxesPage',
);
const PortalSlotsPage = lazyPage(
  () => import('../features/portal/PortalSlotsPage.jsx'),
  'PortalSlotsPage',
);
const PortalAlertsPage = lazyPage(
  () => import('../features/portal/PortalAlertsPage.jsx'),
  'PortalAlertsPage',
);
const PortalInvoicesPage = lazyPage(
  () => import('../features/portal/PortalInvoicesPage.jsx'),
  'PortalInvoicesPage',
);

const STAFF_PAGES = {
  '/app': YardOverviewPage,
  '/app/gate': GatePage,
  '/app/vessels': VesselsPage,
  '/app/work-orders': WorkOrdersPage,
  '/app/customs': CustomsPage,
  '/app/billing': BillingPage,
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
    children: [
      ...STAFF_NAVIGATION.map(staffChildRoute),
      {
        path: 'vessels/:visitId',
        element: (
          <RequireAuth roles={['ADMIN', 'PLANNER']}>
            <VesselDetailPage />
          </RequireAuth>
        ),
      },
    ],
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
