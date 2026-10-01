import { ArrowLeft, FileUp, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/Button.jsx';
import { DataTable } from '../../components/DataTable.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { Panel, SegmentedControl } from '../../components/Layout.jsx';
import { ConfirmDialog, ErrorNote } from '../../components/Overlay.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';
import { StatusChip } from '../../components/StatusChip.jsx';
import { describeCargo, titleCase } from '../../lib/format.js';
import { SlotSuggestionCards } from '../gate/SlotSuggestionCards.jsx';
import { suggestionRequestFor, useSlotSuggestions } from '../yard/yard-api.js';
import { AddItemDialog, ImportItemsDialog } from './VesselForms.jsx';
import { ProgressBar, arrivalLine } from './VesselsPage.jsx';
import {
  VESSEL_STATUS_TONES,
  useDischargeItem,
  useLoadItem,
  useUpdateVisit,
  useVesselVisit,
} from './vessels-api.js';

const AT_BERTH = ['ARRIVED', 'WORKING'];

export function itemsFor(visit, direction) {
  return visit.items.filter((item) => item.direction === direction);
}

const ITEM_COLUMNS = [
  {
    key: 'container',
    header: 'Container',
    render: (item) => <span className="numeric">{item.displayNumber}</span>,
  },
  { key: 'cargo', header: 'Type', render: (item) => describeCargo(item) },
  { key: 'owner', header: 'Owner', render: (item) => item.owner.code },
  {
    key: 'status',
    header: 'Status',
    render: (item) => (
      <span className="flex flex-wrap gap-1">
        <StatusChip
          label={item.status === 'DONE' ? 'Done' : 'Pending'}
          tone={item.status === 'DONE' ? 'accent' : 'neutral'}
        />
        {item.hasHold && <StatusChip label="Hold" />}
        {item.isDangerous && <StatusChip label="DG" tone="warn" />}
      </span>
    ),
  },
  {
    key: 'position',
    header: 'Position',
    render: (item) => <span className="numeric">{item.positionCode ?? '—'}</span>,
  },
];

function DischargePanel({ visit, item, onDone }) {
  const suggestions = useSlotSuggestions(suggestionRequestFor(item, item.owner.id));
  const [chosen, setChosen] = useState(null);
  const selected = chosen ?? suggestions.data?.[0]?.positionCode ?? null;
  const discharge = useDischargeItem(visit.id, { onSuccess: onDone });
  return (
    <div className="flex flex-col gap-4">
      <SlotSuggestionCards
        suggestions={suggestions.data}
        isPending={suggestions.isPending}
        selected={selected}
        onSelect={setChosen}
        compact
      />
      <ErrorNote error={discharge.error} />
      <Button
        size="large"
        disabled={!selected || discharge.isPending}
        onClick={() => discharge.mutate({ itemId: item.id, to: selected })}
      >
        {discharge.isPending ? 'Saving…' : `Discharge to ${selected ?? '…'}`}
      </Button>
    </div>
  );
}

function RelocationNotice({ error }) {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-tile bg-soft-warn p-4 text-sm">
      <p className="font-semibold text-warn">{error.message}</p>
      <ol className="numeric flex flex-col gap-1">
        {error.details.map((order) => (
          <li key={order.id}>
            {order.sequence}. {order.containerNumber} {order.fromPosition} → {order.toPosition}
          </li>
        ))}
      </ol>
      <Link to="/app/work-orders" className="font-medium underline">
        Open the work orders
      </Link>
    </div>
  );
}

function LoadPanel({ visit, item, onDone }) {
  const load = useLoadItem(visit.id, { onSuccess: onDone });
  const waitsForRelocation = load.error?.code === 'RELOCATION_PENDING';
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        {item.positionCode ? (
          <>
            Take the box from <span className="numeric text-ink">{item.positionCode}</span>.
          </>
        ) : (
          'This container is not in the yard yet.'
        )}
      </p>
      {item.hasHold && (
        <p className="rounded-tile bg-soft-danger p-3 text-sm text-danger">
          This container has an active customs hold.
        </p>
      )}
      {waitsForRelocation ? (
        <RelocationNotice error={load.error} />
      ) : (
        <ErrorNote error={load.error} />
      )}
      <Button
        size="large"
        disabled={load.isPending}
        onClick={() => load.mutate({ itemId: item.id })}
      >
        {load.isPending
          ? 'Saving…'
          : waitsForRelocation
            ? 'Try loading again'
            : `Load ${item.displayNumber}`}
      </Button>
    </div>
  );
}

function ConfirmItemPanel({ visit, item, onDone }) {
  if (!item) {
    return (
      <p className="p-5 text-sm text-muted">
        Select a pending container in the list to confirm it.
      </p>
    );
  }
  if (!AT_BERTH.includes(visit.status)) {
    return (
      <p className="p-5 text-sm text-muted">Mark the vessel as arrived before confirming cargo.</p>
    );
  }
  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <p className="numeric text-xl">{item.displayNumber}</p>
        <p className="text-xs text-muted">
          {describeCargo(item)} · {item.owner.name}
        </p>
      </div>
      {item.direction === 'DISCHARGE' ? (
        <DischargePanel key={item.id} visit={visit} item={item} onDone={onDone} />
      ) : (
        <LoadPanel key={item.id} visit={visit} item={item} onDone={onDone} />
      )}
    </div>
  );
}

function StatusActions({ visit }) {
  const [confirmDeparture, setConfirmDeparture] = useState(false);
  const update = useUpdateVisit(visit.id, { onSuccess: () => setConfirmDeparture(false) });
  const openItems =
    visit.load.total - visit.load.done + visit.discharge.total - visit.discharge.done;
  if (visit.status === 'PLANNED') {
    return (
      <Button onClick={() => update.mutate({ status: 'ARRIVED' })} disabled={update.isPending}>
        Mark arrived
      </Button>
    );
  }
  if (!AT_BERTH.includes(visit.status)) {
    return null;
  }
  return (
    <>
      <Button variant="secondary" onClick={() => setConfirmDeparture(true)}>
        Mark departed
      </Button>
      {confirmDeparture && (
        <ConfirmDialog
          title={`Depart ${visit.vesselName}?`}
          confirmLabel={openItems > 0 ? 'Depart with open items' : 'Mark departed'}
          destructive={openItems > 0}
          isPending={update.isPending}
          error={update.error}
          onConfirm={() =>
            update.mutate({ status: 'DEPARTED', departWithOpenItems: openItems > 0 })
          }
          onClose={() => setConfirmDeparture(false)}
        >
          {openItems > 0
            ? `${openItems} containers on this visit are still pending. They stay on the lists as not done.`
            : 'All containers are done.'}
        </ConfirmDialog>
      )}
    </>
  );
}

export function VesselDetailPage() {
  const { visitId } = useParams();
  const { data: visit, isPending, error } = useVesselVisit(visitId);
  const [direction, setDirection] = useState('DISCHARGE');
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [dialog, setDialog] = useState(null);

  if (isPending) {
    return <Skeleton className="mx-auto h-96 max-w-6xl rounded-panel" />;
  }
  if (error) {
    return <ErrorNote error={error} />;
  }

  const items = itemsFor(visit, direction);
  const selectedItem =
    items.find((item) => item.id === selectedItemId && item.status === 'PENDING') ?? null;
  const canEditLists = visit.status !== 'DEPARTED';

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Link
        to="/app/vessels"
        className="inline-flex items-center gap-2 self-start text-sm text-muted hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        All vessels
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[26px] font-semibold">{visit.vesselName}</h1>
            <StatusChip label={titleCase(visit.status)} tone={VESSEL_STATUS_TONES[visit.status]} />
          </div>
          <p className="numeric mt-1 text-sm text-muted">
            Voyage {visit.voyage} · IMO {visit.imoNumber} · {arrivalLine(visit)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditLists && (
            <>
              <Button variant="secondary" onClick={() => setDialog('add')}>
                <Plus size={16} aria-hidden="true" />
                Add container
              </Button>
              <Button variant="secondary" onClick={() => setDialog('import')}>
                <FileUp size={16} aria-hidden="true" />
                Import CSV
              </Button>
            </>
          )}
          <StatusActions visit={visit} />
        </div>
      </div>
      <ProgressBar percent={visit.progressPercent} label="Cargo progress" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <Panel
          title={
            <SegmentedControl
              label="List"
              options={[
                {
                  value: 'DISCHARGE',
                  label: `Discharge ${visit.discharge.done}/${visit.discharge.total}`,
                },
                { value: 'LOAD', label: `Load ${visit.load.done}/${visit.load.total}` },
              ]}
              value={direction}
              onChange={(value) => {
                setDirection(value);
                setSelectedItemId(null);
              }}
            />
          }
        >
          <DataTable
            label={direction === 'DISCHARGE' ? 'Discharge list' : 'Load list'}
            columns={ITEM_COLUMNS}
            rows={items}
            rowKey={(item) => item.id}
            onRowClick={(item) => setSelectedItemId(item.id)}
            rowClassName={(item) =>
              `${item.id === selectedItem?.id ? 'bg-soft-accent' : ''} ${item.status === 'DONE' ? 'opacity-60' : ''}`
            }
            empty={
              <EmptyState
                title={direction === 'DISCHARGE' ? 'No discharge list yet' : 'No load list yet'}
              >
                Add containers one by one or import the list as a CSV file.
              </EmptyState>
            }
          />
        </Panel>
        <Panel
          title={
            selectedItem
              ? direction === 'DISCHARGE'
                ? 'Confirm discharge'
                : 'Confirm load'
              : 'Confirm'
          }
          className="lg:sticky lg:top-20"
        >
          <ConfirmItemPanel
            visit={visit}
            item={selectedItem}
            onDone={() => setSelectedItemId(null)}
          />
        </Panel>
      </div>
      {dialog === 'add' && (
        <AddItemDialog visitId={visit.id} direction={direction} onClose={() => setDialog(null)} />
      )}
      {dialog === 'import' && (
        <ImportItemsDialog visitId={visit.id} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
