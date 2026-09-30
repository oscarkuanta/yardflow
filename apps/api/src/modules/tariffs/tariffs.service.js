import { notFound } from '../../lib/errors.js';
import { paginate } from '../../lib/pagination.js';

export function createTariffsService({ prisma, auditService }) {
  async function list(query) {
    return paginate(prisma, prisma.tariff, { where: {}, query, present: (tariff) => tariff });
  }

  async function update({ size, isDangerous, ...changes }, actor) {
    return prisma.$transaction(async (transaction) => {
      const where = { size_isDangerous: { size, isDangerous } };
      const tariff = await transaction.tariff.findUnique({ where });
      if (!tariff) {
        throw notFound('Tariff not found');
      }
      const saved = await transaction.tariff.update({ where, data: changes });
      await auditService.record(
        {
          userId: actor.id,
          action: 'UPDATE',
          entity: 'Tariff',
          entityId: tariff.id,
          before: tariff,
          after: saved,
          ip: actor.ip,
        },
        transaction,
      );
      return saved;
    });
  }

  return { list, update };
}
