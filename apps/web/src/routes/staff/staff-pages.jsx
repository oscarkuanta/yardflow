import { BarChart3, Boxes, ClipboardCheck, Settings, Shield, Ship, Truck } from 'lucide-react';
import { EmptyState } from '../../components/EmptyState.jsx';

function StaffPage({ title, icon, emptyTitle, children }) {
  return (
    <section aria-labelledby="page-title" className="panel mx-auto max-w-5xl">
      <h1 id="page-title" className="border-b border-line px-5 py-4 text-[22px] font-semibold">
        {title}
      </h1>
      <EmptyState icon={icon} title={emptyTitle}>
        {children}
      </EmptyState>
    </section>
  );
}

export function YardOverviewPage() {
  return (
    <StaffPage title="Yard" icon={Boxes} emptyTitle="The live yard map goes here">
      Every block and stack drawn from its real geometry, with holds, dangerous goods, the live gate
      feed and the vessel at berth around it.
    </StaffPage>
  );
}

export function GatePage() {
  return (
    <StaffPage title="Gate" icon={Truck} emptyTitle="Gate-in and gate-out go here">
      Check a truck with its plate and PIN, inspect the container, pick a slot and print the EIR
      ticket.
    </StaffPage>
  );
}

export function VesselsPage() {
  return (
    <StaffPage title="Vessels" icon={Ship} emptyTitle="Vessel visits go here">
      Every vessel call with its discharge and load lists, progress and the slot for each container.
    </StaffPage>
  );
}

export function WorkOrdersPage() {
  return (
    <StaffPage
      title="Work orders"
      icon={ClipboardCheck}
      emptyTitle="Relocation work orders go here"
    >
      Open relocations grouped per pickup or load, to be completed from the top of the stack down.
    </StaffPage>
  );
}

export function CustomsPage() {
  return (
    <StaffPage title="Customs" icon={Shield} emptyTitle="Customs holds go here">
      Containers on hold, with buttons to place a new hold or release one.
    </StaffPage>
  );
}

export function ReportsPage() {
  return (
    <StaffPage title="Reports" icon={BarChart3} emptyTitle="KPIs and charts go here">
      Occupancy per block, gate moves per day and average dwell per week, with CSV exports.
    </StaffPage>
  );
}

export function AdminPage() {
  return (
    <StaffPage title="Admin" icon={Settings} emptyTitle="Master data goes here">
      Users, companies, blocks, tariffs, time slot capacity and the audit log.
    </StaffPage>
  );
}
