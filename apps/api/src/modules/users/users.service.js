import { conflict, notFound, validationFailed } from '../../lib/errors.js';
import { paginate } from '../../lib/pagination.js';
import { hashSecret } from '../../lib/passwords.js';
import { rethrowUniqueViolation } from '../../lib/prisma-errors.js';
import { revokeSessions } from '../../lib/user-sessions.js';
import { USER_COMPANY_INCLUDE, toPublicUser } from './users.presenter.js';
import { companyRuleProblem, ownAccessProblem } from './users.rules.js';

function emailTaken() {
  return conflict('EMAIL_TAKEN', 'A user with this email already exists');
}

function buildWhere({ role, companyId, isActive, search }) {
  return {
    role,
    companyId,
    isActive,
    ...(search && { OR: [{ name: { contains: search } }, { email: { contains: search } }] }),
  };
}

export function createUsersService({ prisma, auditService, eventBus }) {
  async function assertCompanyFitsRole(role, companyId) {
    const problem = companyRuleProblem(role, companyId);
    if (problem) {
      throw validationFailed([{ field: 'body.companyId', message: problem }]);
    }
    if (companyId !== null && !(await prisma.company.findUnique({ where: { id: companyId } }))) {
      throw validationFailed([{ field: 'body.companyId', message: 'Company not found' }]);
    }
  }

  async function findUserOrThrow(id) {
    const user = await prisma.user.findUnique({ where: { id }, include: USER_COMPANY_INCLUDE });
    if (!user) {
      throw notFound('User not found');
    }
    return user;
  }

  async function list(query) {
    return paginate(prisma, prisma.user, {
      where: buildWhere(query),
      include: USER_COMPANY_INCLUDE,
      query,
      present: toPublicUser,
    });
  }

  async function create({ password, ...input }, actor) {
    await assertCompanyFitsRole(input.role, input.companyId);
    const passwordHash = await hashSecret(password);
    const user = await rethrowUniqueViolation(
      () =>
        prisma.$transaction(async (transaction) => {
          const created = await transaction.user.create({
            data: { ...input, passwordHash },
            include: USER_COMPANY_INCLUDE,
          });
          await auditService.record(
            {
              userId: actor.id,
              action: 'CREATE',
              entity: 'User',
              entityId: created.id,
              after: toPublicUser(created),
              ip: actor.ip,
            },
            transaction,
          );
          return created;
        }),
      emailTaken,
    );
    return toPublicUser(user);
  }

  async function update(id, { password, ...changes }, actor) {
    const existing = await findUserOrThrow(id);
    const accessProblem = ownAccessProblem({ actorId: actor.id, userId: id, changes });
    if (accessProblem) {
      throw conflict('OWN_ACCESS_PROTECTED', accessProblem);
    }
    await assertCompanyFitsRole(
      changes.role ?? existing.role,
      changes.companyId === undefined ? existing.companyId : changes.companyId,
    );
    const passwordHash = password ? await hashSecret(password) : undefined;
    const updated = await rethrowUniqueViolation(
      () =>
        prisma.$transaction(async (transaction) => {
          const saved = await transaction.user.update({
            where: { id },
            data: { ...changes, passwordHash },
            include: USER_COMPANY_INCLUDE,
          });
          await auditService.record(
            {
              userId: actor.id,
              action: 'UPDATE',
              entity: 'User',
              entityId: id,
              before: toPublicUser(existing),
              after: { ...toPublicUser(saved), passwordChanged: Boolean(password) },
              ip: actor.ip,
            },
            transaction,
          );
          return saved;
        }),
      emailTaken,
    );
    if (existing.isActive && !updated.isActive) {
      await revokeSessions(prisma, eventBus, [id]);
    }
    return toPublicUser(updated);
  }

  return { list, create, update };
}
