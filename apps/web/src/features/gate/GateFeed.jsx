import { useState } from 'react';
import { LiveDot } from '../../components/LiveDot.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';
import { formatClock } from '../../lib/format.js';
import { useRealtimeEvent } from '../../lib/realtime.jsx';
import { FEED_KINDS, FEED_LENGTH, mergeFeed } from './gate-feed.js';
import { useGateTransactions } from './gate-api.js';

function FeedItem({ item }) {
  const kind = FEED_KINDS[item.kind];
  return (
    <li className="flex animate-slide-in items-center gap-3 rounded-tile bg-tile p-2.5">
      <span
        className={`numeric inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-control text-[11px] font-semibold ${kind.className}`}
      >
        {kind.label}
      </span>
      <div className="min-w-0 flex-1">
        <p className="numeric truncate text-sm">{item.containerNumber}</p>
        <p className="truncate text-xs text-muted">
          Lane {item.lane} · <span className="numeric">{item.plate}</span> · {item.message}
        </p>
      </div>
      <time className="numeric text-xs text-muted" dateTime={item.at}>
        {formatClock(item.at)}
      </time>
    </li>
  );
}

export function useLiveGateFeed() {
  const [liveEvents, setLiveEvents] = useState([]);
  const transactions = useGateTransactions({ pageSize: FEED_LENGTH });
  useRealtimeEvent('gate:event', (event) => {
    setLiveEvents((current) => [event, ...current].slice(0, FEED_LENGTH));
  });
  return {
    items: mergeFeed(transactions.data?.data ?? [], liveEvents),
    isPending: transactions.isPending,
  };
}

export function GateFeed({ className = '' }) {
  const { items, isPending } = useLiveGateFeed();
  return (
    <section aria-labelledby="staff-gate-feed" className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 id="staff-gate-feed" className="text-base font-semibold">
          Gate feed
        </h2>
        <span className="flex items-center gap-2 text-xs text-muted">
          <LiveDot />
          Live
        </span>
      </div>
      {isPending && [0, 1, 2].map((index) => <Skeleton key={index} className="h-[58px]" />)}
      {!isPending && items.length === 0 && (
        <p className="rounded-tile bg-tile p-4 text-sm text-muted">
          Gate events appear here as soon as trucks pass the gate.
        </p>
      )}
      {items.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Latest gate events">
          {items.map((item) => (
            <FeedItem key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
