import { STAFF_ROLES } from '@yardflow/shared';
import { Server } from 'socket.io';
import {
  CONTAINER_CHANGED,
  GATE_EVENT,
  NOTIFICATION_NEW,
  SESSIONS_REVOKED,
  VESSEL_CHANGED,
  WORK_ORDER_CHANGED,
  YARD_CHANGED,
} from '../lib/event-bus.js';
import { toNotificationResponse } from '../modules/notifications/notifications.service.js';
import { USER_COMPANY_INCLUDE, isAccountActive } from '../modules/users/users.presenter.js';

export const STAFF_ROOM = 'staff';
export const STAFF_EVENTS = [YARD_CHANGED, GATE_EVENT, WORK_ORDER_CHANGED, VESSEL_CHANGED];

export function companyRoom(companyId) {
  return `company:${companyId}`;
}

export function roomFor(user) {
  return STAFF_ROLES.includes(user.role) ? STAFF_ROOM : companyRoom(user.companyId);
}

function createSocketAuthentication(prisma) {
  return async function authenticateSocket(socket, next) {
    const userId = socket.request.session?.userId;
    const user = userId
      ? await prisma.user.findUnique({ where: { id: userId }, include: USER_COMPANY_INCLUDE })
      : null;
    if (!user || !isAccountActive(user)) {
      next(new Error('Not authenticated'));
      return;
    }
    socket.data.user = { id: user.id, role: user.role, companyId: user.companyId };
    next();
  };
}

function disconnectUsers(io, userIds) {
  const revoked = new Set(userIds);
  for (const socket of io.of('/').sockets.values()) {
    if (revoked.has(socket.data.user?.id)) {
      socket.disconnect(true);
    }
  }
}

function relayEvents(io, eventBus) {
  return [
    ...STAFF_EVENTS.map((eventName) =>
      eventBus.subscribe(eventName, (payload) => io.to(STAFF_ROOM).emit(eventName, payload)),
    ),
    eventBus.subscribe(NOTIFICATION_NEW, (notification) =>
      io
        .to(companyRoom(notification.companyId))
        .emit(NOTIFICATION_NEW, toNotificationResponse(notification)),
    ),
    eventBus.subscribe(CONTAINER_CHANGED, ({ companyId, ...change }) =>
      io.to(companyRoom(companyId)).emit(CONTAINER_CHANGED, change),
    ),
    eventBus.subscribe(SESSIONS_REVOKED, ({ userIds }) => disconnectUsers(io, userIds)),
  ];
}

export function attachRealtime({ httpServer, app, prisma, config }) {
  const io = new Server(httpServer, { cors: { origin: config.webOrigin, credentials: true } });
  io.engine.use(app.locals.sessionMiddleware);
  io.use(createSocketAuthentication(prisma));
  io.on('connection', (socket) => {
    socket.join(roomFor(socket.data.user));
  });
  const unsubscribers = relayEvents(io, app.locals.eventBus);
  return {
    io,
    close() {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      return io.close();
    },
  };
}
