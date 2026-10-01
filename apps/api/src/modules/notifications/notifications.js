import { formatContainerNumber } from '@yardflow/shared';
import { formatEuroCents } from '../../lib/format.js';

export const NOTIFICATION_MESSAGES = {
  CONTAINER_IN_YARD: ({ containerNumber, positionCode }) =>
    `${formatContainerNumber(containerNumber)} is in the yard at ${positionCode}.`,
  INVOICE_ISSUED: ({ containerNumber, invoiceNumber, amountCents }) =>
    `Storage invoice ${invoiceNumber} for ${formatContainerNumber(containerNumber)}: ${formatEuroCents(amountCents)}.`,
  GATE_OUT_DONE: ({ containerNumber, truckPlate }) =>
    `${formatContainerNumber(containerNumber)} left the terminal on truck ${truckPlate}.`,
  CUSTOMS_HOLD_PLACED: ({ containerNumber, reason }) =>
    `Customs hold placed on ${formatContainerNumber(containerNumber)}: ${reason}.`,
  CUSTOMS_HOLD_RELEASED: ({ containerNumber }) =>
    `Customs hold released on ${formatContainerNumber(containerNumber)}.`,
  READY_FOR_PICKUP: ({ containerNumber }) =>
    `${formatContainerNumber(containerNumber)} is ready for pickup.`,
  INVOICE_PAID: ({ containerNumber, invoiceNumber }) =>
    `Storage invoice ${invoiceNumber} for ${formatContainerNumber(containerNumber)} is marked as paid.`,
  PRE_ADVICE_EXPIRED: ({ containerNumber, reference }) =>
    `Pre-advice ${reference} for ${formatContainerNumber(containerNumber)} expired because the truck did not arrive in its time slot.`,
};

export async function createNotification(
  transaction,
  { companyId, type, containerNumber, details },
) {
  return transaction.notification.create({
    data: {
      companyId,
      type,
      containerNumber,
      message: NOTIFICATION_MESSAGES[type]({ containerNumber, ...details }),
    },
  });
}
