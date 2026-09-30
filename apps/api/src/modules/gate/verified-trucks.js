import { MINUTE_MS } from '../../lib/terminal-time.js';

export const VERIFICATION_VALID_MS = 30 * MINUTE_MS;

export function rememberVerifiedTruck(session, preAdviceId, now) {
  session.verifiedPreAdvices = {
    ...(session.verifiedPreAdvices ?? {}),
    [preAdviceId]: now.getTime(),
  };
}

export function isVerifiedTruck(session, preAdviceId, now) {
  const verifiedAt = session.verifiedPreAdvices?.[preAdviceId];
  return verifiedAt !== undefined && now.getTime() - verifiedAt <= VERIFICATION_VALID_MS;
}

export function forgetVerifiedTruck(session, preAdviceId) {
  if (session.verifiedPreAdvices) {
    const remaining = { ...session.verifiedPreAdvices };
    delete remaining[preAdviceId];
    session.verifiedPreAdvices = remaining;
  }
}
