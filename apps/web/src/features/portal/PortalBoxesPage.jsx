import { Boxes, CalendarPlus, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/Button.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { SegmentedControl } from '../../components/Layout.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';
import { StatusChip } from '../../components/StatusChip.jsx';
import { TextField } from '../../components/TextField.jsx';
import { describeCargo, formatNumber } from '../../lib/format.js';
import { ContainerDrawer } from '../containers/ContainerDrawer.jsx';
import { BookingSheet } from './BookingSheet.jsx';
import {
  COUNT_FILTERS,
  activePreAdviceByContainer,
  containerStatus,
  latestInvoiceByContainer,
  useContainerCounts,
  useMyContainers,
  useMyInvoices,
  usePreAdvices,
} from './portal-api.js';

const STATE_FILTERS = [
  { value: 'IN_YARD', label: 'In yard' },
  { value: 'EXPECTED', label: 'Expected' },
  { value: 'DEPARTED', label: 'Departed' },
];

const INVOICE_LABELS = { UNPAID: 'Invoice to pay', PAID: 'Invoice paid', VOID: 'Invoice void' };

export function containerLine(container, invoice, preAdvice) {
  const parts = [describeCargo(container)];
  if (container.dwellDays !== null && container.state === 'IN_YARD') {
    parts.push(`day ${container.dwellDays + 1}`);
  }
  if (invoice) {
    parts.push(INVOICE_LABELS[invoice.status]);
  }
  if (preAdvice) {
    parts.push(`${preAdvice.type === 'PICKUP' ? 'Pickup' : 'Delivery'} booked`);
  }
  return parts.join(' · ');
}

function CountSummary({ counts }) {
  return (
    <section className="panel flex flex-col gap-3 p-4" aria-label="Container counts">
      <p className="flex items-baseline gap-2">
        <span className="numeric text-5xl font-medium">{formatNumber(counts.inYard)}</span>
        <span className="text-sm text-muted">containers in the yard</span>
      </p>
      <ul className="flex flex-wrap gap-2">
        {COUNT_FILTERS.map((filter) => (
          <li key={filter.key}>
            <StatusChip
              label={`${filter.label} ${formatNumber(counts[filter.key])}`}
              tone={{ inYard: 'info', onHold: 'danger', expected: 'neutral' }[filter.key]}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function HoldAlert({ count }) {
  if (!count) {
    return null;
  }
  return (
    <p
      role="alert"
      className="flex items-start gap-3 rounded-panel bg-soft-danger p-4 text-sm text-danger"
    >
      <ShieldAlert size={20} className="shrink-0" aria-hidden="true" />
      <span>
        {count === 1 ? '1 container is' : `${count} containers are`} on customs hold. They cannot
        leave the terminal until customs releases them.
      </span>
    </p>
  );
}

function ContainerCard({ container, invoice, preAdvice, onOpen }) {
  const status = containerStatus(container);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(container.number)}
        className="panel flex w-full flex-col gap-2 p-4 text-left transition-colors hover:border-muted"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="numeric text-base">{container.displayNumber}</span>
          <StatusChip label={status.label} tone={status.tone} />
        </span>
        <span className="text-xs text-muted">{containerLine(container, invoice, preAdvice)}</span>
        {container.positionCode && (
          <span className="numeric text-xs text-muted">Position {container.positionCode}</span>
        )}
      </button>
    </li>
  );
}

export function PortalBoxesPage() {
  const [state, setState] = useState('IN_YARD');
  const [search, setSearch] = useState('');
  const [openNumber, setOpenNumber] = useState(null);
  const [booking, setBooking] = useState(null);
  const counts = useContainerCounts();
  const searchValue = search.replace(/\s+/g, '').toUpperCase();
  const { data, isPending } = useMyContainers({
    state,
    search: searchValue.length >= 3 ? searchValue : '',
  });
  const invoices = latestInvoiceByContainer(useMyInvoices().data?.data ?? []);
  const preAdvices = activePreAdviceByContainer(
    usePreAdvices({ status: 'ACTIVE' }).data?.data ?? [],
  );
  const containers = data?.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <CountSummary counts={counts} />
      <HoldAlert count={counts.onHold} />
      <h2 className="mt-2 text-lg font-semibold">Your containers</h2>
      <SegmentedControl
        label="Container state"
        options={STATE_FILTERS}
        value={state}
        onChange={setState}
        className="self-start"
      />
      <TextField
        label="Search by number"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="HNFU 2045"
        inputClassName="numeric"
      />
      {isPending &&
        [0, 1, 2].map((index) => <Skeleton key={index} className="h-24 rounded-panel" />)}
      {!isPending && containers.length === 0 && (
        <div className="panel">
          <EmptyState icon={Boxes} title="No containers here">
            Containers appear when they are announced for a vessel or a delivery.
          </EmptyState>
        </div>
      )}
      <ul className="flex flex-col gap-2" aria-label="Containers">
        {containers.map((container) => (
          <ContainerCard
            key={container.id}
            container={container}
            invoice={invoices.get(container.number)}
            preAdvice={preAdvices.get(container.number)}
            onOpen={setOpenNumber}
          />
        ))}
      </ul>
      {data && data.total > containers.length && (
        <p className="text-center text-xs text-muted">
          Showing the latest {containers.length} of {data.total}. Search by number to find the
          others.
        </p>
      )}
      <div className="sticky bottom-24 z-20 mt-2">
        <Button
          size="large"
          className="w-full shadow-float"
          onClick={() => setBooking({ type: 'PICKUP', container: '' })}
        >
          <CalendarPlus size={18} aria-hidden="true" />
          Book a pickup slot
        </Button>
      </div>
      {openNumber && (
        <ContainerDrawer number={openNumber} onClose={() => setOpenNumber(null)}>
          {(container) =>
            container.state === 'IN_YARD' &&
            !preAdvices.has(container.number) && (
              <Button
                className="w-full"
                onClick={() => {
                  setOpenNumber(null);
                  setBooking({ type: 'PICKUP', container: container.number });
                }}
              >
                Book a pickup for this container
              </Button>
            )
          }
        </ContainerDrawer>
      )}
      {booking && (
        <BookingSheet
          initialType={booking.type}
          initialContainer={booking.container}
          onClose={() => setBooking(null)}
        />
      )}
    </div>
  );
}
