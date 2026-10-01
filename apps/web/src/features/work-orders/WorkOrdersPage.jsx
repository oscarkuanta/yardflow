import { ClipboardCheck } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '../../components/EmptyState.jsx';
import { PageHeader, SegmentedControl } from '../../components/Layout.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';
import { WorkOrderGroupList } from './WorkOrderGroups.jsx';
import { groupWorkOrders, useWorkOrders } from './work-orders-api.js';

const STATUS_FILTERS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: '', label: 'All' },
];

const EMPTY_TEXT = {
  OPEN: 'Nothing to relocate. Work orders appear when a pickup or a load finds boxes stacked on top.',
  DONE: 'No relocation has been completed yet.',
  CANCELLED: 'No relocation was cancelled.',
  '': 'No relocations yet.',
};

export function WorkOrdersPage() {
  const [status, setStatus] = useState('OPEN');
  const { data, isPending } = useWorkOrders({ status, sort: 'createdAt:desc' });
  const groups = groupWorkOrders(data?.data ?? []);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Work orders"
        description="Relocations grouped per pickup or load. Complete them from the top of the stack down."
      />
      <SegmentedControl
        label="Status"
        options={STATUS_FILTERS}
        value={status}
        onChange={setStatus}
        className="mb-4"
      />
      <section className="panel p-5" aria-label="Work order groups">
        {isPending && <Skeleton className="h-40" />}
        {!isPending && groups.length === 0 && (
          <EmptyState icon={ClipboardCheck} title="No work orders here">
            {EMPTY_TEXT[status]}
          </EmptyState>
        )}
        {groups.length > 0 && <WorkOrderGroupList groups={groups} />}
      </section>
    </div>
  );
}
