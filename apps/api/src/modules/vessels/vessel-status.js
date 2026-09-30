export const AT_BERTH_STATUSES = ['ARRIVED', 'WORKING'];

const ALLOWED_CHANGES = {
  ARRIVED: ['PLANNED'],
  DEPARTED: ['ARRIVED', 'WORKING'],
};

export function isAtBerth(status) {
  return AT_BERTH_STATUSES.includes(status);
}

export function statusAfterCargoWork(status) {
  return status === 'ARRIVED' ? 'WORKING' : status;
}

export function statusChangeProblem({ from, to, pendingLoadCount, departWithOpenItems }) {
  if (!ALLOWED_CHANGES[to]?.includes(from)) {
    return {
      code: 'INVALID_STATUS_CHANGE',
      message: `A visit cannot go from ${from} to ${to}. The order is PLANNED, ARRIVED, WORKING, DEPARTED, and WORKING starts with the first discharge or load`,
    };
  }
  if (to === 'DEPARTED' && pendingLoadCount > 0 && !departWithOpenItems) {
    const noun = pendingLoadCount === 1 ? 'load item is' : 'load items are';
    return {
      code: 'LOAD_ITEMS_PENDING',
      message: `${pendingLoadCount} ${noun} still pending. Confirm "Depart with open items" to depart anyway`,
    };
  }
  return null;
}
