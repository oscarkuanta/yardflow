import { SESSIONS_REVOKED } from './event-bus.js';

function userIdInSession(data) {
  try {
    return JSON.parse(data ?? '{}').userId ?? null;
  } catch {
    return null;
  }
}

export async function destroySessionsOfUsers(prisma, userIds) {
  const wantedIds = new Set(userIds);
  if (wantedIds.size === 0) {
    return 0;
  }
  const candidates = await prisma.session.findMany({
    where: { OR: [...wantedIds].map((userId) => ({ data: { contains: `"userId":${userId}` } })) },
    select: { sessionId: true, data: true },
  });
  const sessionIds = candidates
    .filter((session) => wantedIds.has(userIdInSession(session.data)))
    .map((session) => session.sessionId);
  if (sessionIds.length > 0) {
    await prisma.session.deleteMany({ where: { sessionId: { in: sessionIds } } });
  }
  return sessionIds.length;
}

export async function revokeSessions(prisma, eventBus, userIds) {
  const destroyedCount = await destroySessionsOfUsers(prisma, userIds);
  eventBus.publish(SESSIONS_REVOKED, { userIds });
  return destroyedCount;
}
