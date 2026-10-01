import { ArrowRight, Check } from 'lucide-react';
import { Button } from '../../components/Button.jsx';
import { ErrorNote } from '../../components/Overlay.jsx';
import { StatusChip } from '../../components/StatusChip.jsx';
import { formatDateTime } from '../../lib/format.js';
import { useCompleteWorkOrder } from './work-orders-api.js';

const STATUS_TONES = { OPEN: 'warn', DONE: 'accent', CANCELLED: 'neutral' };
const STATUS_LABELS = { OPEN: 'Open', DONE: 'Done', CANCELLED: 'Cancelled' };

function WorkOrderRow({ order, isNext, canComplete, complete }) {
  const isWorking = complete.isPending && complete.variables?.id === order.id;
  return (
    <li className="flex items-center gap-3 rounded-tile bg-tile px-3 py-2.5">
      <span className="numeric inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-xs text-muted">
        {order.sequence}
      </span>
      <div className="min-w-0 flex-1">
        <p className="numeric truncate text-sm">{order.containerNumber}</p>
        <p className="numeric flex items-center gap-1.5 text-xs text-muted">
          {order.fromPosition}
          <ArrowRight size={12} aria-hidden="true" />
          {order.toPosition}
        </p>
      </div>
      {order.status === 'OPEN' && canComplete ? (
        <Button
          variant={isNext ? 'primary' : 'secondary'}
          className="min-h-10 px-3"
          disabled={!isNext || complete.isPending}
          onClick={() => complete.mutate(order)}
          aria-label={`Mark relocation of ${order.containerNumber} done`}
          title={isNext ? undefined : 'Complete the earlier relocations in this group first'}
        >
          <Check size={16} aria-hidden="true" />
          {isWorking ? '…' : 'Done'}
        </Button>
      ) : (
        <StatusChip label={STATUS_LABELS[order.status]} tone={STATUS_TONES[order.status]} />
      )}
    </li>
  );
}

export function WorkOrderGroup({ group, canComplete, complete }) {
  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium">
          For <span className="numeric">{group.targetContainerNumber}</span>
        </p>
        <p className="text-xs text-muted">{formatDateTime(group.createdAt)}</p>
      </div>
      <p className="text-xs text-muted">{group.reason}</p>
      <ol className="flex flex-col gap-1.5">
        {group.orders.map((order) => (
          <WorkOrderRow
            key={order.id}
            order={order}
            isNext={order.id === group.nextOpenId}
            canComplete={canComplete}
            complete={complete}
          />
        ))}
      </ol>
    </li>
  );
}

export function WorkOrderGroupList({ groups, canComplete = true }) {
  const complete = useCompleteWorkOrder();
  return (
    <div className="flex flex-col gap-3">
      <ErrorNote error={complete.error} />
      <ul className="flex flex-col gap-4">
        {groups.map((group) => (
          <WorkOrderGroup
            key={group.groupKey}
            group={group}
            canComplete={canComplete}
            complete={complete}
          />
        ))}
      </ul>
    </div>
  );
}
