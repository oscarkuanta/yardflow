import { Bell, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/Button.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { SegmentedControl } from '../../components/Layout.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';
import { formatDateTime } from '../../lib/format.js';
import { useMarkAllRead, useMarkRead, useNotifications } from './portal-api.js';

export const ALERT_TONES = {
  CUSTOMS_HOLD_PLACED: 'bg-danger',
  PRE_ADVICE_EXPIRED: 'bg-warn',
  INVOICE_ISSUED: 'bg-warn',
  READY_FOR_PICKUP: 'bg-accent',
  CUSTOMS_HOLD_RELEASED: 'bg-accent',
};

function AlertItem({ notification, onRead }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => !notification.isRead && onRead(notification)}
        className={`panel flex w-full items-start gap-3 p-4 text-left ${notification.isRead ? 'opacity-70' : ''}`}
        aria-label={`${notification.isRead ? '' : 'Unread: '}${notification.message}`}
      >
        <span
          aria-hidden="true"
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
            notification.isRead ? 'bg-tile' : (ALERT_TONES[notification.type] ?? 'bg-info')
          }`}
        />
        <span className="flex flex-col gap-1">
          <span className="text-sm">{notification.message}</span>
          <span className="text-xs text-muted">{formatDateTime(notification.createdAt)}</span>
        </span>
      </button>
    </li>
  );
}

export function PortalAlertsPage() {
  const [filter, setFilter] = useState('');
  const { data, isPending } = useNotifications({ unread: filter });
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const notifications = data?.data ?? [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Alerts</h2>
        <Button
          variant="secondary"
          disabled={!data?.unreadCount || markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
        >
          <CheckCheck size={16} aria-hidden="true" />
          Mark all read
        </Button>
      </div>
      <SegmentedControl
        label="Alerts"
        options={[
          { value: '', label: 'All' },
          { value: 'true', label: `Unread${data?.unreadCount ? ` ${data.unreadCount}` : ''}` },
        ]}
        value={filter}
        onChange={setFilter}
        className="self-start"
      />
      {isPending &&
        [0, 1, 2].map((index) => <Skeleton key={index} className="h-20 rounded-panel" />)}
      {!isPending && notifications.length === 0 && (
        <div className="panel">
          <EmptyState icon={Bell} title="No alerts">
            You are told here when a container arrives, is held or released, is ready, or leaves.
          </EmptyState>
        </div>
      )}
      <ul className="flex flex-col gap-2" aria-label="Alerts">
        {notifications.map((notification) => (
          <AlertItem key={notification.id} notification={notification} onRead={markRead.mutate} />
        ))}
      </ul>
    </div>
  );
}
