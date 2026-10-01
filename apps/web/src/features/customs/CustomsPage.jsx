import { Plus, Shield } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/Button.jsx';
import { DataTable, Pagination } from '../../components/DataTable.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { ContainerNumberField, TextAreaField } from '../../components/Fields.jsx';
import { PageHeader, Panel, SegmentedControl } from '../../components/Layout.jsx';
import { ConfirmDialog, Dialog, ErrorNote } from '../../components/Overlay.jsx';
import { StatusChip } from '../../components/StatusChip.jsx';
import { fieldErrors } from '../../lib/api.js';
import { formatDateTime } from '../../lib/format.js';
import { usePlaceHold, useCustomsHolds, useReleaseHold } from './customs-api.js';

const PAGE_SIZE = 25;
const STATE_LABELS = { EXPECTED: 'Expected', IN_YARD: 'In yard', DEPARTED: 'Departed' };

function PlaceHoldDialog({ onClose }) {
  const [containerNumber, setContainerNumber] = useState('');
  const [reason, setReason] = useState('');
  const place = usePlaceHold({ onSuccess: onClose });
  const errors = fieldErrors(place.error);
  function submit(event) {
    event.preventDefault();
    place.mutate({ containerNumber, reason });
  }
  return (
    <Dialog
      title="Place a customs hold"
      description="A container on hold cannot leave the terminal until the hold is released."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="place-hold" disabled={place.isPending}>
            {place.isPending ? 'Placing…' : 'Place hold'}
          </Button>
        </>
      }
    >
      <form id="place-hold" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <ContainerNumberField
          value={containerNumber}
          onChange={setContainerNumber}
          error={errors.containerNumber}
        />
        <TextAreaField
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          error={errors.reason}
          maxLength={200}
          placeholder="X-ray inspection requested"
        />
        {Object.keys(errors).length === 0 && <ErrorNote error={place.error} />}
      </form>
    </Dialog>
  );
}

export function CustomsPage() {
  const [filter, setFilter] = useState('true');
  const [page, setPage] = useState(1);
  const [isPlacing, setIsPlacing] = useState(false);
  const [releasing, setReleasing] = useState(null);
  const { data, isPending } = useCustomsHolds({ isActive: filter, page, pageSize: PAGE_SIZE });
  const release = useReleaseHold({ onSuccess: () => setReleasing(null) });

  const columns = [
    {
      key: 'container',
      header: 'Container',
      render: (hold) => <span className="numeric">{hold.displayNumber}</span>,
    },
    { key: 'owner', header: 'Owner', render: (hold) => hold.owner.name },
    {
      key: 'where',
      header: 'Where',
      render: (hold) => (
        <span className="numeric">{hold.positionCode ?? STATE_LABELS[hold.containerState]}</span>
      ),
    },
    { key: 'reason', header: 'Reason', wrap: true, render: (hold) => hold.reason },
    {
      key: 'placed',
      header: 'Placed',
      render: (hold) => (
        <span className="text-muted">
          {formatDateTime(hold.placedAt)} · {hold.placedBy.name}
        </span>
      ),
    },
    {
      key: 'action',
      header: <span className="sr-only">Action</span>,
      className: 'text-right',
      render: (hold) =>
        hold.isActive ? (
          <Button
            variant="destructive"
            className="min-h-10 px-3"
            onClick={() => setReleasing(hold)}
          >
            Release
          </Button>
        ) : (
          <StatusChip label={`Released ${formatDateTime(hold.releasedAt)}`} tone="neutral" />
        ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Customs"
        description="Containers held by customs. A held container fails the gate-out check."
        actions={
          <Button onClick={() => setIsPlacing(true)}>
            <Plus size={16} aria-hidden="true" />
            Place hold
          </Button>
        }
      />
      <Panel
        title={
          <SegmentedControl
            label="Holds"
            options={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Released' },
              { value: '', label: 'All' },
            ]}
            value={filter}
            onChange={(value) => {
              setFilter(value);
              setPage(1);
            }}
          />
        }
      >
        <DataTable
          label="Customs holds"
          columns={columns}
          rows={data?.data ?? []}
          rowKey={(hold) => hold.id}
          isPending={isPending}
          empty={
            <EmptyState icon={Shield} title="No holds here">
              Use "Place hold" when customs asks to stop a container.
            </EmptyState>
          }
        />
        {data && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
        )}
      </Panel>
      {isPlacing && <PlaceHoldDialog onClose={() => setIsPlacing(false)} />}
      {releasing && (
        <ConfirmDialog
          title={`Release the hold on ${releasing.displayNumber}?`}
          confirmLabel="Release hold"
          isPending={release.isPending}
          error={release.error}
          onConfirm={() => release.mutate(releasing)}
          onClose={() => setReleasing(null)}
        >
          Reason was: {releasing.reason}. The owner is told that the container is free.
        </ConfirmDialog>
      )}
    </div>
  );
}
