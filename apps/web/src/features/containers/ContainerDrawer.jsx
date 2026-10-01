import { Drawer, ErrorNote } from '../../components/Overlay.jsx';
import { KeyValue } from '../../components/Layout.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';
import { StatusChip } from '../../components/StatusChip.jsx';
import { describeCargo, formatDateTime, formatEuro, titleCase } from '../../lib/format.js';
import { CONTAINER_STATE_LABELS, useContainer } from './containers-api.js';

const MOVEMENT_LABELS = {
  GATE_IN: 'Gate-in',
  GATE_OUT: 'Gate-out',
  DISCHARGE: 'Discharge',
  LOAD: 'Load',
  YARD_MOVE: 'Yard move',
  RELOCATION: 'Relocation',
};

export function movementLine(movement) {
  const from = movement.fromPosition ?? 'outside';
  const to = movement.toPosition ?? 'outside';
  return `${MOVEMENT_LABELS[movement.type] ?? movement.type}: ${from} → ${to}`;
}

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function ContainerDetails({ container }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        <StatusChip label={CONTAINER_STATE_LABELS[container.state]} />
        {container.hasHold && <StatusChip label="Hold" />}
        {container.isDangerous && (
          <StatusChip label={`DG ${container.imoClass ?? ''}`} tone="warn" />
        )}
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <KeyValue label="Owner">{container.owner.name}</KeyValue>
        <KeyValue label="Type">{describeCargo(container)}</KeyValue>
        <KeyValue label="Position">
          <span className="numeric">{container.positionCode ?? '—'}</span>
        </KeyValue>
        <KeyValue label="Days in yard">{container.dwellDays ?? '—'}</KeyValue>
        <KeyValue label="Gate-in">{formatDateTime(container.gateInAt)}</KeyValue>
        <KeyValue label="Departed">{formatDateTime(container.departedAt)}</KeyValue>
      </dl>
      {container.holds.length > 0 && (
        <Section title="Customs holds">
          <ul className="flex flex-col gap-1.5 text-sm">
            {container.holds.map((hold) => (
              <li key={hold.id} className="rounded-tile bg-tile px-3 py-2">
                {hold.reason}
                <span className="block text-xs text-muted">
                  {hold.isActive ? 'Active' : 'Released'} · placed {formatDateTime(hold.placedAt)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {container.invoices.length > 0 && (
        <Section title="Invoices">
          <ul className="flex flex-col gap-1.5 text-sm">
            {container.invoices.map((invoice) => (
              <li
                key={invoice.id}
                className="flex justify-between gap-2 rounded-tile bg-tile px-3 py-2"
              >
                <span className="numeric">{invoice.number}</span>
                <span className="numeric">
                  {formatEuro(invoice.amountCents)} · {titleCase(invoice.status)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="History">
        <ol className="flex flex-col gap-2 text-sm">
          {container.history.map((movement, index) => (
            <li key={index} className="flex flex-col">
              <span className="numeric">{movementLine(movement)}</span>
              <span className="text-xs text-muted">
                {formatDateTime(movement.at)}
                {movement.by ? ` · ${movement.by.name}` : ''}
              </span>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

export function ContainerDrawer({ number, onClose }) {
  const { data: container, isPending, error } = useContainer(number);
  return (
    <Drawer title={container?.displayNumber ?? number} subtitle="Container" onClose={onClose}>
      {isPending && <Skeleton className="h-64" />}
      <ErrorNote error={error} />
      {container && <ContainerDetails container={container} />}
    </Drawer>
  );
}
