import { formatContainerNumber } from '@yardflow/shared';

export const NOTIFICATION_MESSAGES = {
  CONTAINER_IN_YARD: ({ containerNumber, positionCode }) =>
    `${formatContainerNumber(containerNumber)} is in the yard at ${positionCode}.`,
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
