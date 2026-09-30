import { formatContainerNumber } from '@yardflow/shared';
import { formatEuroCents } from './format.js';
import { findOne, hoursAfter, hoursBefore } from './seed-context.js';

const RECENT_ARRIVAL_HOURS = 3;
const RECENT_GATE_OUT_HOURS = 48;

function containerById(context, id) {
  return findOne(context.tables.containers, (container) => container.id === id);
}

function earlierOf(first, second) {
  return first < second ? first : second;
}

function addNotification(context, { container, type, message, createdAt, read }) {
  context.insert('notifications', {
    companyId: container.ownerCompanyId,
    type,
    message,
    containerNumber: container.number,
    readAt: read ? earlierOf(hoursAfter(createdAt, 1), context.now) : null,
    createdAt,
  });
}

function addHoldNotifications(context) {
  for (const hold of context.tables.customsHolds) {
    const container = containerById(context, hold.containerId);
    const number = formatContainerNumber(container.number);
    addNotification(context, {
      container,
      type: 'CUSTOMS_HOLD_PLACED',
      message: `Customs hold placed on ${number}: ${hold.reason}.`,
      createdAt: hold.placedAt,
      read: hold.releasedAt !== null,
    });
    if (hold.releasedAt) {
      addNotification(context, {
        container,
        type: 'CUSTOMS_HOLD_RELEASED',
        message: `Customs hold released on ${number}.`,
        createdAt: hold.releasedAt,
        read: true,
      });
    }
  }
}

function addInvoiceNotifications(context, pickups) {
  for (const { invoice, container } of pickups) {
    if (invoice.amountCents === 0) {
      continue;
    }
    const number = formatContainerNumber(container.number);
    addNotification(context, {
      container,
      type: 'INVOICE_ISSUED',
      message: `Storage invoice ${invoice.number} for ${number}: ${formatEuroCents(invoice.amountCents)}.`,
      createdAt: invoice.createdAt,
      read: invoice.status === 'PAID',
    });
    if (invoice.status === 'PAID') {
      addNotification(context, {
        container,
        type: 'INVOICE_PAID',
        message: `Storage invoice ${invoice.number} for ${number} is marked as paid.`,
        createdAt: invoice.paidAt,
        read: false,
      });
    }
  }
}

function addArrivalNotifications(context, dischargedToday) {
  for (const container of dischargedToday) {
    const positionCode = context.containerInfo.get(container.id).positionCode;
    addNotification(context, {
      container,
      type: 'CONTAINER_IN_YARD',
      message: `${formatContainerNumber(container.number)} is in the yard at ${positionCode}.`,
      createdAt: container.gateInAt,
      read: container.gateInAt < hoursBefore(context.now, RECENT_ARRIVAL_HOURS),
    });
  }
}

function addGateOutNotifications(context) {
  const since = hoursBefore(context.now, RECENT_GATE_OUT_HOURS);
  const recentGateOuts = context.tables.gateTransactions.filter(
    (transaction) => transaction.direction === 'OUT' && transaction.createdAt > since,
  );
  for (const transaction of recentGateOuts) {
    const container = containerById(context, transaction.containerId);
    addNotification(context, {
      container,
      type: 'GATE_OUT_DONE',
      message: `${formatContainerNumber(container.number)} left the terminal on truck ${transaction.truckPlate}.`,
      createdAt: transaction.createdAt,
      read: true,
    });
  }
}

export function addNotifications(context, { pickups, dischargedToday }) {
  addHoldNotifications(context);
  addInvoiceNotifications(context, pickups);
  addArrivalNotifications(context, dischargedToday);
  addGateOutNotifications(context);
  context.tables.notifications.sort((first, second) => first.createdAt - second.createdAt);
  context.tables.notifications.forEach((notification, index) => {
    notification.id = index + 1;
  });
}
