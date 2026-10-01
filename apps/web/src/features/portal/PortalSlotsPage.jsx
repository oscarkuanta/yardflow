import { CalendarClock, CalendarPlus, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/Button.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { SegmentedControl } from '../../components/Layout.jsx';
import { ConfirmDialog, Dialog } from '../../components/Overlay.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';
import { StatusChip } from '../../components/StatusChip.jsx';
import { formatDate, titleCase } from '../../lib/format.js';
import { slotLabel } from '../gate/gate-flow.js';
import { BookingSheet } from './BookingSheet.jsx';
import { PinReveal } from './PinReveal.jsx';
import { useCancelPreAdvice, usePreAdvices, useRegeneratePin } from './portal-api.js';

const PRE_ADVICE_TONES = { ACTIVE: 'accent', USED: 'info', CANCELLED: 'neutral', EXPIRED: 'warn' };

function PreAdviceCard({ preAdvice, onNewPin, onCancel }) {
  const isActive = preAdvice.status === 'ACTIVE';
  return (
    <li className="panel flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">
            {preAdvice.type === 'PICKUP' ? 'Pickup' : 'Delivery'} ·{' '}
            <span className="numeric">{preAdvice.displayNumber}</span>
          </p>
          <p className="numeric text-xs text-muted">{preAdvice.reference}</p>
        </div>
        <StatusChip label={titleCase(preAdvice.status)} tone={PRE_ADVICE_TONES[preAdvice.status]} />
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted">Slot</dt>
          <dd className="numeric">
            {formatDate(preAdvice.timeSlot.startsAt)} · {slotLabel(preAdvice.timeSlot)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Truck</dt>
          <dd className="numeric">{preAdvice.truckPlate}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted">Driver</dt>
          <dd>{preAdvice.driverName}</dd>
        </div>
      </dl>
      {isActive && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => onNewPin(preAdvice)}>
            <KeyRound size={16} aria-hidden="true" />
            New PIN
          </Button>
          <Button variant="destructive" onClick={() => onCancel(preAdvice)}>
            Cancel
          </Button>
        </div>
      )}
    </li>
  );
}

export function PortalSlotsPage() {
  const [view, setView] = useState('ACTIVE');
  const [isBooking, setIsBooking] = useState(false);
  const [renewing, setRenewing] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const { data, isPending } = usePreAdvices(view === 'ACTIVE' ? { status: 'ACTIVE' } : {});
  const regenerate = useRegeneratePin();
  const cancel = useCancelPreAdvice({ onSuccess: () => setCancelling(null) });
  const preAdvices = (data?.data ?? []).filter(
    (preAdvice) => view === 'ACTIVE' || preAdvice.status !== 'ACTIVE',
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Your slots</h2>
        <Button onClick={() => setIsBooking(true)}>
          <CalendarPlus size={16} aria-hidden="true" />
          Book a slot
        </Button>
      </div>
      <SegmentedControl
        label="Slots"
        options={[
          { value: 'ACTIVE', label: 'Upcoming' },
          { value: 'HISTORY', label: 'History' },
        ]}
        value={view}
        onChange={setView}
        className="self-start"
      />
      {isPending && [0, 1].map((index) => <Skeleton key={index} className="h-40 rounded-panel" />)}
      {!isPending && preAdvices.length === 0 && (
        <div className="panel">
          <EmptyState
            icon={CalendarClock}
            title={view === 'ACTIVE' ? 'No upcoming slots' : 'No past slots'}
          >
            Book a delivery or pickup slot and give the PIN to your driver.
          </EmptyState>
        </div>
      )}
      <ul className="flex flex-col gap-2" aria-label="Pre-advices">
        {preAdvices.map((preAdvice) => (
          <PreAdviceCard
            key={preAdvice.id}
            preAdvice={preAdvice}
            onNewPin={setRenewing}
            onCancel={setCancelling}
          />
        ))}
      </ul>
      {isBooking && <BookingSheet onClose={() => setIsBooking(false)} />}
      {renewing && !regenerate.data && (
        <ConfirmDialog
          title={`New PIN for ${renewing.reference}?`}
          confirmLabel="Create new PIN"
          isPending={regenerate.isPending}
          error={regenerate.error}
          onConfirm={() => regenerate.mutate(renewing)}
          onClose={() => {
            setRenewing(null);
            regenerate.reset();
          }}
        >
          The old PIN stops working at once.
        </ConfirmDialog>
      )}
      {renewing && regenerate.data && (
        <Dialog
          title="New PIN"
          onClose={() => {
            setRenewing(null);
            regenerate.reset();
          }}
        >
          <PinReveal
            preAdvice={regenerate.data}
            onDone={() => {
              setRenewing(null);
              regenerate.reset();
            }}
          />
        </Dialog>
      )}
      {cancelling && (
        <ConfirmDialog
          title={`Cancel ${cancelling.reference}?`}
          confirmLabel="Cancel booking"
          destructive
          isPending={cancel.isPending}
          error={cancel.error}
          onConfirm={() => cancel.mutate(cancelling)}
          onClose={() => setCancelling(null)}
        >
          The slot is freed for other trucks and the PIN stops working.
        </ConfirmDialog>
      )}
    </div>
  );
}
