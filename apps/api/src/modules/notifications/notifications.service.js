import { notFound } from '../../lib/errors.js';
import { paginate } from '../../lib/pagination.js';

export function toNotificationResponse(notification) {
  return {
    id: notification.id,
    type: notification.type,
    message: notification.message,
    containerNumber: notification.containerNumber,
    isRead: notification.readAt !== null,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}

export function createNotificationsService({ prisma, clock }) {
  async function list(query, user) {
    const companyWhere = { companyId: user.companyId };
    const [page, unreadCount] = await Promise.all([
      paginate(prisma, prisma.notification, {
        where: {
          ...companyWhere,
          type: query.type,
          ...(query.unread !== undefined && { readAt: query.unread ? null : { not: null } }),
        },
        query,
        present: toNotificationResponse,
      }),
      prisma.notification.count({ where: { ...companyWhere, readAt: null } }),
    ]);
    return { ...page, unreadCount };
  }

  async function markRead(id, user) {
    const notification = await prisma.notification.findFirst({
      where: { id, companyId: user.companyId },
    });
    if (!notification) {
      throw notFound('Notification not found');
    }
    if (notification.readAt !== null) {
      return toNotificationResponse(notification);
    }
    const saved = await prisma.notification.update({ where: { id }, data: { readAt: clock() } });
    return toNotificationResponse(saved);
  }

  async function markAllRead(user) {
    const { count } = await prisma.notification.updateMany({
      where: { companyId: user.companyId, readAt: null },
      data: { readAt: clock() },
    });
    return { markedRead: count };
  }

  return { list, markRead, markAllRead };
}
