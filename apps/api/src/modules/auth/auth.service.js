import bcrypt from 'bcrypt';
import { invalidCredentials } from '../../lib/errors.js';
import { BCRYPT_ROUNDS } from '../../lib/passwords.js';
import { USER_COMPANY_INCLUDE } from '../users/users.presenter.js';

const TIMING_GUARD_HASH = bcrypt.hashSync('yardflow-timing-guard', BCRYPT_ROUNDS);

function loginFailureReason(user, passwordMatches) {
  if (!user) {
    return 'UNKNOWN_EMAIL';
  }
  if (!passwordMatches) {
    return 'WRONG_PASSWORD';
  }
  if (!user.isActive) {
    return 'INACTIVE_USER';
  }
  return user.company?.isActive === false ? 'INACTIVE_COMPANY' : null;
}

export function createAuthService({ prisma, auditService }) {
  async function verifyCredentials({ email, password, ip }) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: USER_COMPANY_INCLUDE,
    });
    const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? TIMING_GUARD_HASH);
    const failureReason = loginFailureReason(user, passwordMatches);
    if (failureReason) {
      await auditService.record({
        userId: user?.id ?? null,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user?.id ?? email,
        after: { email, reason: failureReason },
        ip,
      });
      throw invalidCredentials();
    }
    return user;
  }

  async function recordLogin(user, ip) {
    return prisma.$transaction(async (transaction) => {
      const loggedInUser = await transaction.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
        include: USER_COMPANY_INCLUDE,
      });
      await auditService.record(
        { userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, ip },
        transaction,
      );
      return loggedInUser;
    });
  }

  async function recordLogout(user, ip) {
    await auditService.record({
      userId: user.id,
      action: 'LOGOUT',
      entity: 'User',
      entityId: user.id,
      ip,
    });
  }

  return { verifyCredentials, recordLogin, recordLogout };
}
