import { LiveDot } from '../../components/LiveDot.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';
import { formatClock } from '../../lib/format.js';

const KIND_STYLES = {
  IN: { label: 'IN', className: 'bg-soft-accent text-accent-text' },
  OUT: { label: 'OUT', className: 'bg-soft-info text-info' },
};
const SIZE_LABELS = { FT20: "20'", FT40: "40'", FT45: "45'" };

export function FeedRow({ event }) {
  const kind = KIND_STYLES[event.kind];
  return (
    <li className="flex items-center gap-3 rounded-tile bg-tile p-2.5">
      <span
        className={`numeric inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-control text-xs font-medium ${kind.className}`}
      >
        {kind.label}
      </span>
      <div className="min-w-0 flex-1">
        <p className="numeric truncate text-sm text-ink">{event.containerNumber}</p>
        <p className="truncate text-xs text-muted">
          {SIZE_LABELS[event.size]} · Lane {event.lane} ·{' '}
          <span className="numeric">{event.plate}</span>
        </p>
      </div>
      <time className="numeric text-xs text-muted" dateTime={event.at}>
        {formatClock(event.at)}
      </time>
    </li>
  );
}

function FeedBody({ stats, isPending }) {
  if (isPending) {
    return [0, 1, 2].map((index) => <Skeleton key={index} className="h-[58px]" />);
  }
  if (!stats || stats.recentGateEvents.length === 0) {
    return (
      <p className="rounded-tile bg-tile p-4 text-sm text-muted">
        Gate events appear here as soon as trucks pass the gate.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2" aria-label="Latest gate events">
      {stats.recentGateEvents.map((event) => (
        <FeedRow key={`${event.at}-${event.plate}`} event={event} />
      ))}
    </ul>
  );
}

export function GateFeedCard({ stats, isPending }) {
  return (
    <section aria-labelledby="gate-feed-title" className="glass flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <h2 id="gate-feed-title" className="text-base font-semibold">
          Gate feed
        </h2>
        <span className="flex items-center gap-2 text-xs text-muted">
          <LiveDot />
          Live
        </span>
      </div>
      <FeedBody stats={stats} isPending={isPending} />
      <p className="text-xs text-muted">Plates and container numbers are masked on this page.</p>
    </section>
  );
}
