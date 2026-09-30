import { NOTIFICATION_NEW } from '../../lib/event-bus.js';
import { calendarDateToDbDate, terminalDateOf } from '../../lib/terminal-time.js';
import { createNotification } from '../notifications/notifications.js';
import {
  cancelOpenRelocations,
  publishWorkOrderChanges,
} from '../workorders/workorders.service.js';
import { isOverdue, slotWindow } from './pre-advice-window.js';

export const EXPIRY_INTERVAL_MS = 5 * 60 * 1000;

export function createPreAdviceExpiry({ prisma, auditService, eventBus, clock, toleranceMin }) {
  async function expireOne(preAdvice) {
    return prisma.$transaction(async (transaction) => {
      const { count } = await transaction.preAdvice.updateMany({
        where: { id: preAdvice.id, status: 'ACTIVE' },
        data: { status: 'EXPIRED' },
      });
      if (count === 0) {
        return null;
      }
      const container = await transaction.container.findUnique({
        where: { number: preAdvice.containerNumber },
      });
      const cancelled =
        preAdvice.type === 'PICKUP' && container
          ? await cancelOpenRelocations(transaction, container.id)
          : [];
      const notification = await createNotification(transaction, {
        companyId: preAdvice.companyId,
        type: 'PRE_ADVICE_EXPIRED',
        containerNumber: preAdvice.containerNumber,
        details: { reference: preAdvice.reference },
      });
      await auditService.record(
        {
          userId: null,
          action: 'EXPIRE',
          entity: 'PreAdvice',
          entityId: preAdvice.id,
          before: { status: 'ACTIVE' },
          after: { status: 'EXPIRED', cancelledWorkOrders: cancelled.length },
        },
        transaction,
      );
      return { notification, cancelled };
    });
  }

  async function expireOverdue() {
    const now = clock();
    const candidates = await prisma.preAdvice.findMany({
      where: {
        status: 'ACTIVE',
        timeSlot: { date: { lte: calendarDateToDbDate(terminalDateOf(now)) } },
      },
      include: { timeSlot: true },
    });
    const overdue = candidates.filter((preAdvice) =>
      isOverdue(slotWindow(preAdvice.timeSlot, toleranceMin), now),
    );
    let expiredCount = 0;
    for (const preAdvice of overdue) {
      const result = await expireOne(preAdvice);
      if (result) {
        expiredCount += 1;
        publishWorkOrderChanges(eventBus, result.cancelled);
        eventBus.publish(NOTIFICATION_NEW, result.notification);
      }
    }
    return expiredCount;
  }

  return { expireOverdue };
}
