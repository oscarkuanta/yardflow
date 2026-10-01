import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/Button.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { SelectField } from '../../components/Fields.jsx';
import { Panel } from '../../components/Layout.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';
import { TextField } from '../../components/TextField.jsx';
import {
  SIZE_LABELS,
  addDaysToCalendarDate,
  formatDecimal,
  formatEuro,
  terminalCalendarDate,
} from '../../lib/format.js';
import { FormDialog } from './AdminParts.jsx';
import {
  changedFields,
  euroToCents,
  mondayOf,
  numberFields,
  slotHours,
  weekDates,
} from './admin-forms.js';
import {
  useListQuery,
  useSaveResource,
  useUpdateCapacity,
  useUpdateTariff,
  useWeekTimeSlots,
} from './admin-api.js';

const BLOCK_NUMBER_FIELDS = ['rows', 'bays', 'maxTier', 'mapX', 'mapY', 'gateDistanceM'];
const EMPTY_BLOCK = {
  code: '',
  type: 'STANDARD',
  sizeClass: 'SMALL',
  rows: '',
  bays: '',
  maxTier: '',
  mapX: '',
  mapY: '',
  gateDistanceM: '',
};

function BlockDialog({ block, onClose }) {
  const original = block
    ? Object.fromEntries(Object.keys(EMPTY_BLOCK).map((field) => [field, block[field]]))
    : EMPTY_BLOCK;
  const [form, setForm] = useState(original);
  const save = useSaveResource('blocks', {
    successMessage: block ? `Block ${block.code} saved` : 'Block created',
    onSuccess: onClose,
    invalidate: [['yard']],
  });
  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });
  function submit() {
    const typed = numberFields(form, BLOCK_NUMBER_FIELDS);
    if (!block) {
      save.mutate({ body: typed });
      return;
    }
    const geometry = changedFields(original, typed);
    delete geometry.code;
    save.mutate({ id: block.id, body: geometry });
  }
  const numberInput = (field, label, errors) => (
    <TextField
      label={label}
      type="number"
      value={form[field]}
      onChange={set(field)}
      error={errors[field]}
      inputClassName="numeric"
    />
  );
  return (
    <FormDialog
      title={block ? `Edit block ${block.code}` : 'New block'}
      formId="block-form"
      mutation={save}
      onClose={onClose}
      onSubmit={submit}
    >
      {(errors) => (
        <>
          <TextField
            label="Code"
            value={form.code}
            onChange={(event) =>
              setForm({ ...form, code: event.target.value.toUpperCase().slice(0, 2) })
            }
            error={errors.code}
            disabled={Boolean(block)}
            inputClassName="numeric"
          />
          <SelectField
            label="Type"
            value={form.type}
            onChange={set('type')}
            error={errors.type}
            options={[
              { value: 'STANDARD', label: 'Standard (full)' },
              { value: 'EMPTY', label: 'Empty containers' },
              { value: 'DG', label: 'Dangerous goods' },
            ]}
          />
          <SelectField
            label="Size class"
            value={form.sizeClass}
            onChange={set('sizeClass')}
            error={errors.sizeClass}
            options={[
              { value: 'SMALL', label: "Small (20')" },
              { value: 'LARGE', label: "Large (40' and 45')" },
            ]}
          />
          {numberInput('maxTier', 'Maximum tier', errors)}
          {numberInput('rows', 'Rows', errors)}
          {numberInput('bays', 'Bays', errors)}
          {numberInput('mapX', 'Map X', errors)}
          {numberInput('mapY', 'Map Y', errors)}
          {numberInput('gateDistanceM', 'Distance to gate (m)', errors)}
          {block && (
            <p className="text-xs text-muted sm:col-span-2">
              Shrinking a block is refused when it would cut stacks that hold containers.
            </p>
          )}
        </>
      )}
    </FormDialog>
  );
}

export function BlocksTab() {
  const [editing, setEditing] = useState(null);
  const { data, isPending } = useListQuery('blocks', { pageSize: 100 });
  const columns = [
    {
      key: 'code',
      header: 'Block',
      render: (block) => <span className="numeric font-medium">{block.code}</span>,
    },
    { key: 'type', header: 'Type', render: (block) => `${block.type} · ${block.sizeClass}` },
    {
      key: 'size',
      header: 'Rows × bays × tiers',
      render: (block) => (
        <span className="numeric">
          {block.rows} × {block.bays} × {block.maxTier}
        </span>
      ),
    },
    {
      key: 'map',
      header: 'Map position',
      render: (block) => (
        <span className="numeric text-muted">
          {block.mapX}, {block.mapY} · {block.gateDistanceM} m
        </span>
      ),
    },
    {
      key: 'occupancy',
      header: 'Occupancy',
      render: (block) => (
        <span className="numeric">
          {formatDecimal(block.occupancy.occupancyPercent)}% · {block.occupancy.usedSlots}/
          {block.occupancy.capacitySlots}
        </span>
      ),
    },
  ];
  return (
    <Panel
      title="Blocks"
      actions={
        <Button onClick={() => setEditing('new')}>
          <Plus size={16} aria-hidden="true" />
          New block
        </Button>
      }
    >
      <DataTable
        label="Blocks"
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(block) => block.id}
        isPending={isPending}
        onRowClick={setEditing}
      />
      {editing && (
        <BlockDialog block={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </Panel>
  );
}

function TariffDialog({ tariff, onClose }) {
  const [freeDays, setFreeDays] = useState(String(tariff.freeDays));
  const [dailyRate, setDailyRate] = useState((tariff.dailyRateCents / 100).toFixed(2));
  const update = useUpdateTariff({ onSuccess: onClose });
  function submit() {
    update.mutate({
      size: tariff.size,
      isDangerous: tariff.isDangerous,
      freeDays: Number(freeDays),
      dailyRateCents: euroToCents(dailyRate),
    });
  }
  return (
    <FormDialog
      title={`Tariff ${SIZE_LABELS[tariff.size]}${tariff.isDangerous ? ' DG' : ''}`}
      formId="tariff-form"
      mutation={update}
      onClose={onClose}
      onSubmit={submit}
    >
      {(errors) => (
        <>
          <TextField
            label="Free days"
            type="number"
            value={freeDays}
            onChange={(event) => setFreeDays(event.target.value)}
            error={errors.freeDays}
            inputClassName="numeric"
          />
          <TextField
            label="Daily rate (EUR)"
            inputMode="decimal"
            value={dailyRate}
            onChange={(event) => setDailyRate(event.target.value)}
            error={errors.dailyRateCents}
            inputClassName="numeric"
          />
          <p className="text-xs text-muted sm:col-span-2">
            New rates apply to invoices created from now on.
          </p>
        </>
      )}
    </FormDialog>
  );
}

export function TariffsTab() {
  const [editing, setEditing] = useState(null);
  const { data, isPending } = useListQuery('tariffs');
  const columns = [
    { key: 'size', header: 'Size', render: (tariff) => SIZE_LABELS[tariff.size] },
    {
      key: 'dg',
      header: 'Cargo',
      render: (tariff) => (tariff.isDangerous ? 'Dangerous goods' : 'General'),
    },
    {
      key: 'free',
      header: 'Free days',
      render: (tariff) => <span className="numeric">{tariff.freeDays}</span>,
    },
    {
      key: 'rate',
      header: 'Per day after',
      render: (tariff) => <span className="numeric">{formatEuro(tariff.dailyRateCents)}</span>,
    },
  ];
  return (
    <Panel title="Storage tariffs">
      <DataTable
        label="Tariffs"
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(tariff) => tariff.id}
        isPending={isPending}
        onRowClick={setEditing}
      />
      {editing && <TariffDialog tariff={editing} onClose={() => setEditing(null)} />}
    </Panel>
  );
}

function CapacityDialog({ target, onClose }) {
  const [capacity, setCapacity] = useState(String(target.capacity));
  const [scope, setScope] = useState('slot');
  const update = useUpdateCapacity({ onSuccess: onClose });
  function submit() {
    const body = scope === 'slot' ? { slotId: target.slot.id } : { date: target.slot.date };
    update.mutate({ ...body, capacity: Number(capacity) });
  }
  return (
    <FormDialog
      title={`Capacity ${target.slot.date} · ${String(target.slot.startHour).padStart(2, '0')}:00`}
      formId="capacity-form"
      mutation={update}
      onClose={onClose}
      onSubmit={submit}
    >
      {(errors) => (
        <>
          <TextField
            label="Trucks per hour"
            type="number"
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
            error={errors.capacity}
            inputClassName="numeric"
            hint={`${target.slot.booked} already booked`}
          />
          <SelectField
            label="Apply to"
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            options={[
              { value: 'slot', label: 'This hour only' },
              { value: 'day', label: 'Every hour of this day' },
            ]}
          />
        </>
      )}
    </FormDialog>
  );
}

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function capacityTone(slot) {
  if (slot.capacity === 0) {
    return 'bg-tile text-muted';
  }
  if (slot.isFull) {
    return 'bg-soft-danger text-danger';
  }
  return slot.booked / slot.capacity >= 0.75
    ? 'bg-soft-warn text-warn'
    : 'bg-soft-accent text-accent-text';
}

export function TimeSlotsTab() {
  const [monday, setMonday] = useState(() => mondayOf(terminalCalendarDate(new Date())));
  const [editing, setEditing] = useState(null);
  const dates = weekDates(monday);
  const days = useWeekTimeSlots(dates);
  const slotsByDay = days.map((day) => day.data ?? []);
  const hours = slotHours(slotsByDay);
  const isPending = days.some((day) => day.isPending);
  return (
    <Panel
      title="Time slot capacity"
      actions={
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => setMonday(addDaysToCalendarDate(monday, -7))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-tile"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span className="numeric px-2 text-sm">Week of {monday}</span>
          <button
            type="button"
            aria-label="Next week"
            onClick={() => setMonday(addDaysToCalendarDate(monday, 7))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-tile"
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      }
    >
      {isPending ? (
        <Skeleton className="m-4 h-80" />
      ) : (
        <div className="overflow-x-auto p-4">
          <table
            className="w-full min-w-[640px] border-separate border-spacing-1 text-sm"
            aria-label="Booked and capacity per hour"
          >
            <thead>
              <tr className="text-xs text-muted">
                <th scope="col" className="w-16 text-left font-medium">
                  Hour
                </th>
                {dates.map((date, index) => (
                  <th key={date} scope="col" className="font-medium">
                    {WEEKDAY_NAMES[index]}{' '}
                    <span className="numeric">
                      {date.slice(8)}.{date.slice(5, 7)}.
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours.map((hour) => (
                <tr key={hour}>
                  <th scope="row" className="numeric text-left text-xs font-normal text-muted">
                    {String(hour).padStart(2, '0')}:00
                  </th>
                  {slotsByDay.map((slots, index) => {
                    const slot = slots.find((candidate) => candidate.startHour === hour);
                    if (!slot) {
                      return (
                        <td
                          key={dates[index]}
                          className="rounded-control bg-tile/40 text-center text-xs text-muted"
                        >
                          Closed
                        </td>
                      );
                    }
                    return (
                      <td key={dates[index]}>
                        <button
                          type="button"
                          onClick={() => setEditing({ slot, capacity: slot.capacity })}
                          className={`numeric h-11 w-full rounded-control text-xs ${capacityTone(slot)}`}
                          aria-label={`${slot.date} ${hour}:00, ${slot.booked} of ${slot.capacity} booked`}
                        >
                          {slot.booked}/{slot.capacity}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">
            Booked / capacity. Click a cell to change the capacity.
          </p>
        </div>
      )}
      {editing && <CapacityDialog target={editing} onClose={() => setEditing(null)} />}
    </Panel>
  );
}
