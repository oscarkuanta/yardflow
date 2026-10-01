import { Bell, Boxes, CalendarClock, Receipt } from 'lucide-react';
import { EmptyState } from '../../components/EmptyState.jsx';

function PortalPage({ title, icon, emptyTitle, children }) {
  return (
    <section aria-labelledby="portal-title" className="panel">
      <h2 id="portal-title" className="border-b border-line px-4 py-3 text-base font-semibold">
        {title}
      </h2>
      <EmptyState icon={icon} title={emptyTitle}>
        {children}
      </EmptyState>
    </section>
  );
}

export function PortalBoxesPage() {
  return (
    <PortalPage title="Your containers" icon={Boxes} emptyTitle="Your containers go here">
      Each container with its status, position, days in the yard and invoice state.
    </PortalPage>
  );
}

export function PortalSlotsPage() {
  return (
    <PortalPage title="Time slots" icon={CalendarClock} emptyTitle="Slot booking goes here">
      Book a delivery or pickup slot for your truck and get its six-digit PIN.
    </PortalPage>
  );
}

export function PortalAlertsPage() {
  return (
    <PortalPage title="Alerts" icon={Bell} emptyTitle="Your notifications go here">
      Containers that arrive, customs holds, invoices and gate-outs, live as they happen.
    </PortalPage>
  );
}

export function PortalInvoicesPage() {
  return (
    <PortalPage title="Invoices" icon={Receipt} emptyTitle="Your storage invoices go here">
      Every storage invoice with its period, amount and a PDF to download.
    </PortalPage>
  );
}
