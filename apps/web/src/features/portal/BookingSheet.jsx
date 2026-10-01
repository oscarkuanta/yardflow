import { useState } from 'react';
import { Button } from '../../components/Button.jsx';
import { CheckboxField, ContainerNumberField, SelectField } from '../../components/Fields.jsx';
import { SegmentedControl } from '../../components/Layout.jsx';
import { Dialog, ErrorNote } from '../../components/Overlay.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';
import { TextField } from '../../components/TextField.jsx';
import { fieldErrors } from '../../lib/api.js';
import { terminalCalendarDate } from '../../lib/format.js';
import { slotLabel } from '../gate/gate-flow.js';
import { PinReveal } from './PinReveal.jsx';
import {
  bookingDates,
  slotAvailability,
  useAvailableSlots,
  useCreatePreAdvice,
  useMyContainers,
} from './portal-api.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EMPTY_CARGO = {
  size: 'FT40',
  isHighCube: false,
  loadStatus: 'FULL',
  isDangerous: false,
  imoClass: '',
  grossWeightKg: '',
};

export function bookingBody({ type, containerNumber, slotId, truckPlate, driverName, cargo }) {
  const base = { type, timeSlotId: slotId, containerNumber, truckPlate, driverName };
  if (type === 'PICKUP') {
    return base;
  }
  return {
    ...base,
    size: cargo.size,
    isHighCube: cargo.isHighCube,
    loadStatus: cargo.loadStatus,
    isDangerous: cargo.isDangerous,
    imoClass: cargo.isDangerous && cargo.imoClass ? cargo.imoClass : null,
    grossWeightKg: cargo.grossWeightKg === '' ? undefined : Number(cargo.grossWeightKg),
  };
}

export function slotStartLabel(slot) {
  return `${String(slot.startHour).padStart(2, '0')}:00`;
}

export function dateChipLabel(date) {
  const weekday = WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
  return { weekday, day: `${date.slice(8)}.${date.slice(5, 7)}.` };
}

function DateChips({ dates, value, onChange }) {
  return (
    <div
      className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      role="radiogroup"
      aria-label="Day"
    >
      {dates.map((date) => {
        const { weekday, day } = dateChipLabel(date);
        const isActive = date === value;
        return (
          <button
            key={date}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(date)}
            className={`flex min-h-14 min-w-14 shrink-0 flex-col items-center justify-center rounded-tile px-2 text-xs ${
              isActive ? 'bg-accent font-semibold text-on-accent' : 'bg-tile text-muted'
            }`}
          >
            <span>{weekday}</span>
            <span className="numeric text-sm">{day}</span>
          </button>
        );
      })}
    </div>
  );
}

function SlotGrid({ date, value, onChange, error }) {
  const { data: slots, isPending } = useAvailableSlots(date);
  const now = new Date();
  if (isPending) {
    return <Skeleton className="h-32 rounded-tile" />;
  }
  if (!slots?.length) {
    return (
      <p className="rounded-tile bg-tile p-4 text-sm text-muted">The gate is closed on this day.</p>
    );
  }
  return (
    <div>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Time slot">
        {slots.map((slot) => {
          const availability = slotAvailability(slot, now);
          const isActive = slot.id === value;
          return (
            <button
              key={slot.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={!availability.bookable}
              onClick={() => onChange(slot)}
              className={`flex min-h-14 flex-col items-center justify-center rounded-tile text-xs disabled:opacity-40 ${
                isActive ? 'bg-accent font-semibold text-on-accent' : 'bg-tile'
              }`}
            >
              <span className="numeric text-base">{slotStartLabel(slot)}</span>
              <span className={isActive ? '' : 'text-muted'}>{availability.reason}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}

export const PICKUP_SUGGESTIONS_ID = 'pickup-container-suggestions';

function PickupContainerField({ value, onChange, error }) {
  const { data } = useMyContainers({ state: 'IN_YARD' });
  const containers = data?.data ?? [];
  return (
    <>
      <ContainerNumberField
        label="Container to pick up"
        value={value}
        onChange={onChange}
        error={error}
        list={PICKUP_SUGGESTIONS_ID}
      />
      <datalist id={PICKUP_SUGGESTIONS_ID}>
        {containers
          .filter((container) => !container.hasHold)
          .map((container) => (
            <option key={container.number} value={container.number}>
              {container.displayNumber}
            </option>
          ))}
      </datalist>
    </>
  );
}

function CargoFields({ cargo, onChange, errors }) {
  const set = (field) => (event) => onChange({ ...cargo, [field]: event.target.value });
  return (
    <div className="grid grid-cols-2 gap-3">
      <SelectField
        label="Size"
        value={cargo.size}
        onChange={set('size')}
        error={errors.size}
        options={[
          { value: 'FT20', label: "20'" },
          { value: 'FT40', label: "40'" },
          { value: 'FT45', label: "45'" },
        ]}
      />
      <SelectField
        label="Load"
        value={cargo.loadStatus}
        onChange={set('loadStatus')}
        error={errors.loadStatus}
        options={[
          { value: 'FULL', label: 'Full' },
          { value: 'EMPTY', label: 'Empty' },
        ]}
      />
      <TextField
        label="Gross weight (kg)"
        type="number"
        inputMode="numeric"
        value={cargo.grossWeightKg}
        onChange={set('grossWeightKg')}
        error={errors.grossWeightKg}
        className="col-span-2"
        inputClassName="numeric"
      />
      <CheckboxField
        label="High cube"
        checked={cargo.isHighCube}
        onChange={(isHighCube) => onChange({ ...cargo, isHighCube })}
      />
      <CheckboxField
        label="Dangerous goods"
        checked={cargo.isDangerous}
        onChange={(isDangerous) => onChange({ ...cargo, isDangerous })}
      />
      {cargo.isDangerous && (
        <TextField
          label="IMO class"
          value={cargo.imoClass}
          onChange={set('imoClass')}
          error={errors.imoClass}
          className="col-span-2"
          inputClassName="numeric"
          placeholder="3"
        />
      )}
    </div>
  );
}

export function BookingSheet({ initialType = 'PICKUP', initialContainer = '', onClose }) {
  const dates = bookingDates(terminalCalendarDate(new Date()));
  const [type, setType] = useState(initialType);
  const [containerNumber, setContainerNumber] = useState(initialContainer);
  const [date, setDate] = useState(dates[0]);
  const [slot, setSlot] = useState(null);
  const [truckPlate, setTruckPlate] = useState('');
  const [driverName, setDriverName] = useState('');
  const [cargo, setCargo] = useState(EMPTY_CARGO);
  const create = useCreatePreAdvice();
  const errors = fieldErrors(create.error);

  if (create.data) {
    return (
      <Dialog title="Slot booked" onClose={onClose}>
        <PinReveal preAdvice={create.data} onDone={onClose} />
      </Dialog>
    );
  }

  function submit(event) {
    event.preventDefault();
    create.mutate(
      bookingBody({ type, containerNumber, slotId: slot?.id, truckPlate, driverName, cargo }),
    );
  }

  return (
    <Dialog
      title={type === 'PICKUP' ? 'Book a pickup slot' : 'Book a delivery slot'}
      onClose={onClose}
      footer={
        <Button
          type="submit"
          form="booking-form"
          size="large"
          className="w-full"
          disabled={!slot || create.isPending}
        >
          {create.isPending
            ? 'Booking…'
            : slot
              ? `Confirm ${slotLabel(slot)}`
              : 'Choose a time slot'}
        </Button>
      }
    >
      <form id="booking-form" onSubmit={submit} noValidate className="flex flex-col gap-5">
        <SegmentedControl
          label="Booking type"
          options={[
            { value: 'PICKUP', label: 'Pickup' },
            { value: 'DELIVERY', label: 'Delivery' },
          ]}
          value={type}
          onChange={(value) => {
            setType(value);
            setContainerNumber('');
            create.reset();
          }}
          className="self-start"
        />
        {type === 'PICKUP' ? (
          <PickupContainerField
            value={containerNumber}
            onChange={setContainerNumber}
            error={errors.containerNumber}
          />
        ) : (
          <>
            <ContainerNumberField
              value={containerNumber}
              onChange={setContainerNumber}
              error={errors.containerNumber}
            />
            <CargoFields cargo={cargo} onChange={setCargo} errors={errors} />
          </>
        )}
        <section className="flex flex-col gap-2" aria-label="Day and time">
          <p className="text-xs font-medium text-muted">Day and time</p>
          <DateChips
            dates={dates}
            value={date}
            onChange={(nextDate) => {
              setDate(nextDate);
              setSlot(null);
            }}
          />
          <SlotGrid date={date} value={slot?.id} onChange={setSlot} error={errors.timeSlotId} />
        </section>
        <TextField
          label="Truck plate"
          value={truckPlate}
          onChange={(event) => setTruckPlate(event.target.value.toUpperCase())}
          error={errors.truckPlate}
          autoComplete="off"
          inputClassName="numeric"
          placeholder="HH-YF 482"
        />
        <TextField
          label="Driver name"
          value={driverName}
          onChange={(event) => setDriverName(event.target.value)}
          error={errors.driverName}
          autoComplete="off"
        />
        {type === 'PICKUP' && (
          <p className="rounded-tile bg-tile p-3 text-xs text-muted">
            When you confirm, we issue the storage invoice up to the end of this slot. The truck can
            only leave once it is paid.
          </p>
        )}
        {Object.keys(errors).length === 0 && <ErrorNote error={create.error} />}
      </form>
    </Dialog>
  );
}
