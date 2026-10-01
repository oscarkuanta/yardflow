import { Plus, Ship } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { PageHeader, SegmentedControl } from '../../components/Layout.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';
import { StatusChip } from '../../components/StatusChip.jsx';
import { formatDateTime, titleCase } from '../../lib/format.js';
import { NewVisitDialog } from './VesselForms.jsx';
import { VESSEL_STATUS_TONES, useVesselVisits } from './vessels-api.js';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'PLANNED', label: 'Planned' },
  { value: 'ARRIVED', label: 'Arrived' },
  { value: 'WORKING', label: 'Working' },
  { value: 'DEPARTED', label: 'Departed' },
];

export function arrivalLine(visit) {
  if (visit.atd) {
    return `Departed ${formatDateTime(visit.atd)}`;
  }
  if (visit.ata) {
    return `Arrived ${formatDateTime(visit.ata)} · ETD ${formatDateTime(visit.etd)}`;
  }
  return `ETA ${formatDateTime(visit.eta)} · ETD ${formatDateTime(visit.etd)}`;
}

export function ProgressBar({ percent, label }) {
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-tile"
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span className="block h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
    </div>
  );
}

function VisitCard({ visit }) {
  return (
    <li>
      <Link
        to={`/app/vessels/${visit.id}`}
        className="panel flex h-full flex-col gap-3 p-5 transition-colors hover:border-muted"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{visit.vesselName}</h2>
            <p className="numeric text-xs text-muted">
              Voyage {visit.voyage} · IMO {visit.imoNumber}
            </p>
          </div>
          <StatusChip label={titleCase(visit.status)} tone={VESSEL_STATUS_TONES[visit.status]} />
        </div>
        <p className="text-sm text-muted">{arrivalLine(visit)}</p>
        <ProgressBar percent={visit.progressPercent} label={`${visit.vesselName} progress`} />
        <p className="numeric text-xs text-muted">
          Discharge {visit.discharge.done}/{visit.discharge.total} · Load {visit.load.done}/
          {visit.load.total} · {visit.progressPercent}%
        </p>
      </Link>
    </li>
  );
}

export function VesselsPage() {
  const [status, setStatus] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { data, isPending } = useVesselVisits({ status, sort: 'eta:asc' });
  const visits = data?.data ?? [];
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Vessels"
        description="Vessel calls with their discharge and load lists."
        actions={
          <Button onClick={() => setIsCreating(true)}>
            <Plus size={16} aria-hidden="true" />
            New visit
          </Button>
        }
      />
      <SegmentedControl
        label="Status"
        options={STATUS_FILTERS}
        value={status}
        onChange={setStatus}
        className="mb-4"
      />
      {isPending && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-44 rounded-panel" />
          ))}
        </div>
      )}
      {!isPending && visits.length === 0 && (
        <div className="panel">
          <EmptyState icon={Ship} title="No vessel visits">
            Create a visit with "New visit", then add its discharge and load lists.
          </EmptyState>
        </div>
      )}
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visits.map((visit) => (
          <VisitCard key={visit.id} visit={visit} />
        ))}
      </ul>
      {isCreating && <NewVisitDialog onClose={() => setIsCreating(false)} />}
    </div>
  );
}
