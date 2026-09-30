import { conflict, notFound } from '../../lib/errors.js';
import { paginate } from '../../lib/pagination.js';
import { rethrowUniqueViolation } from '../../lib/prisma-errors.js';
import { destroySessionsOfUsers } from '../../lib/user-sessions.js';

const COMPANY_INCLUDE = { _count: { select: { users: true } } };

export function toCompanyResponse({ _count, ...company }) {
  return { ...company, userCount: _count?.users ?? 0 };
}

function companyCodeTaken() {
  return conflict('COMPANY_CODE_TAKEN', 'A company with this code already exists');
}

function buildWhere({ isActive, search }) {
  return {
    isActive,
    ...(search && { OR: [{ name: { contains: search } }, { code: { contains: search } }] }),
  };
}

export function createCompaniesService({ prisma, auditService }) {
  async function list(query) {
    return paginate(prisma, prisma.company, {
      where: buildWhere(query),
      include: COMPANY_INCLUDE,
      query,
      present: toCompanyResponse,
    });
  }

  async function create(input, actor) {
    const company = await rethrowUniqueViolation(
      () =>
        prisma.$transaction(async (transaction) => {
          const created = await transaction.company.create({
            data: input,
            include: COMPANY_INCLUDE,
          });
          await auditService.record(
            {
              userId: actor.id,
              action: 'CREATE',
              entity: 'Company',
              entityId: created.id,
              after: toCompanyResponse(created),
              ip: actor.ip,
            },
            transaction,
          );
          return created;
        }),
      companyCodeTaken,
    );
    return toCompanyResponse(company);
  }

  async function endCustomerSessions(companyId) {
    const users = await prisma.user.findMany({ where: { companyId }, select: { id: true } });
    await destroySessionsOfUsers(
      prisma,
      users.map((user) => user.id),
    );
  }

  async function update(id, changes, actor) {
    const existing = await prisma.company.findUnique({ where: { id }, include: COMPANY_INCLUDE });
    if (!existing) {
      throw notFound('Company not found');
    }
    const updated = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.company.update({
        where: { id },
        data: changes,
        include: COMPANY_INCLUDE,
      });
      await auditService.record(
        {
          userId: actor.id,
          action: 'UPDATE',
          entity: 'Company',
          entityId: id,
          before: toCompanyResponse(existing),
          after: toCompanyResponse(saved),
          ip: actor.ip,
        },
        transaction,
      );
      return saved;
    });
    if (existing.isActive && !updated.isActive) {
      await endCustomerSessions(id);
    }
    return toCompanyResponse(updated);
  }

  return { list, create, update };
}
