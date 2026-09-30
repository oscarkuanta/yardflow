import bcrypt from 'bcrypt';
import { invalidCredentials } from '../../lib/errors.js';
import { CURRENT_USER_INCLUDE } from '../../middleware/authenticate.js';

export const PASSWORD_BCRYPT_ROUNDS = 10;
const TIMING_GUARD_HASH = bcrypt.hashSync('yardflow-timing-guard', PASSWORD_BCRYPT_ROUNDS);

export function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
    company: user.company ?? null,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

function loginFailureReason(user, passwordMatches) {
  if (!user) {
    return 'UNKNOWN_EMAIL';
  }
  if (!passwordMatches) {
    return 'WRONG_PASSWORD';
  }
  return user.isActive ? null : 'INACTIVE_USER';
}

export function createAuthService({ prisma, auditService }) {
  async function verifyCredentials({ email, password, ip }) {
    const user = await prisma.user.findUnique({ where: { email } });
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
        include: CURRENT_USER_INCLUDE,
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
