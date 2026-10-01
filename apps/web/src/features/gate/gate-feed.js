export const FEED_LENGTH = 8;
export const HOURS_IN_SPARKLINE = 24;
const HOUR_MS = 3_600_000;

export const FEED_KINDS = {
  IN: { label: 'IN', className: 'bg-soft-accent text-accent-text' },
  OUT: { label: 'OUT', className: 'bg-soft-info text-info' },
  DENIED: { label: 'DENY', className: 'bg-soft-danger text-danger' },
  WAITING: { label: 'WAIT', className: 'bg-soft-warn text-warn' },
};

export function feedItemFromTransaction(transaction) {
  return {
    id: `transaction-${transaction.id}`,
    kind: transaction.direction,
    containerNumber: transaction.displayNumber,
    lane: transaction.lane,
    plate: transaction.truckPlate,
    message: transaction.direction === 'IN' ? 'Gate-in complete' : 'Gate-out complete',
    at: transaction.createdAt,
    eirUrl: transaction.eirUrl,
  };
}

export function feedItemFromEvent(event) {
  return {
    id: `event-${event.id}`,
    kind: event.kind,
    containerNumber: event.containerNumber,
    lane: event.lane,
    plate: event.plate,
    message: event.message,
    at: typeof event.at === 'string' ? event.at : new Date(event.at).toISOString(),
    eirUrl: null,
  };
}

export function mergeFeed(transactions, liveEvents) {
  const items = [
    ...transactions.map(feedItemFromTransaction),
    ...liveEvents
      .filter((event) => event.kind === 'DENIED' || event.kind === 'WAITING')
      .map(feedItemFromEvent),
  ];
  return items
    .sort((first, second) => new Date(second.at) - new Date(first.at))
    .slice(0, FEED_LENGTH);
}

export function hourlyMoves(transactions, now) {
  const buckets = Array.from({ length: HOURS_IN_SPARKLINE }, () => 0);
  const end = now.getTime();
  for (const transaction of transactions) {
    const age = end - new Date(transaction.createdAt).getTime();
    if (age < 0 || age >= HOURS_IN_SPARKLINE * HOUR_MS) {
      continue;
    }
    buckets[HOURS_IN_SPARKLINE - 1 - Math.floor(age / HOUR_MS)] += 1;
  }
  return buckets;
}

export function dayBalance(transactions) {
  return transactions.reduce(
    (balance, transaction) => {
      if (transaction.direction === 'IN') {
        balance.in += 1;
      } else {
        balance.out += 1;
      }
      balance.net = balance.in - balance.out;
      return balance;
    },
    { in: 0, out: 0, net: 0 },
  );
}
