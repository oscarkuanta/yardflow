import { notFound } from '../../lib/errors.js';
import { paginate } from '../../lib/pagination.js';
import { isCustomer, ownedContainersScope } from '../../lib/scope.js';
import { toWorkOrderResponse } from '../workorders/workorders.service.js';
import { toContainerDetail, toContainerSummary } from './containers.presenter.js';

const USER_NAME = { select: { id: true, name: true } };

export const SUMMARY_INCLUDE = {
  ownerCompany: { select: { id: true, code: true, name: true } },
  position: { include: { block: { select: { code: true } } } },
  holds: { where: { releasedAt: null }, select: { id: true, releasedAt: true } },
};

const DETAIL_INCLUDE = {
  ...SUMMARY_INCLUDE,
  holds: {
    orderBy: { placedAt: 'desc' },
    include: { placedBy: USER_NAME, releasedBy: USER_NAME },
  },
  invoices: { orderBy: { createdAt: 'desc' } },
  movements: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: { user: USER_NAME } },
};

function holdFilter(hasHold) {
  if (hasHold === undefined) {
    return {};
  }
  const activeHold = { some: { releasedAt: null } };
  return { holds: hasHold ? activeHold : { none: { releasedAt: null } } };
}

export function buildContainersWhere(query, user) {
  return {
    ...ownedContainersScope(user),
    ...holdFilter(query.hasHold),
    state: query.state,
    size: query.size,
    loadStatus: query.loadStatus,
    isDangerous: query.isDangerous,
    ...(query.search && { number: { contains: query.search } }),
    ...(query.ownerCode && !isCustomer(user) && { ownerCompany: { code: query.ownerCode } }),
    ...(query.blockCode && { position: { block: { code: query.blockCode } } }),
  };
}

export function createContainersService({ prisma, clock }) {
  async function list(query, user) {
    const now = clock();
    return paginate(prisma, prisma.container, {
      where: buildContainersWhere(query, user),
      include: SUMMARY_INCLUDE,
      query,
      present: (container) => toContainerSummary(container, now),
    });
  }

  async function detail(number, user) {
    const container = await prisma.container.findFirst({
      where: { number, ...ownedContainersScope(user) },
      include: DETAIL_INCLUDE,
    });
    if (!container) {
      throw notFound('Container not found');
    }
    const showStaffDetails = !isCustomer(user);
    const openWorkOrders = showStaffDetails
      ? await prisma.workOrder.findMany({
          where: {
            status: 'OPEN',
            OR: [{ containerId: container.id }, { targetContainerId: container.id }],
          },
          orderBy: [{ groupKey: 'asc' }, { sequence: 'asc' }],
          include: {
            container: { select: { number: true } },
            targetContainer: { select: { number: true } },
            completedBy: USER_NAME,
          },
        })
      : [];
    return toContainerDetail(container, {
      now: clock(),
      showStaffDetails,
      openWorkOrders: openWorkOrders.map(toWorkOrderResponse),
    });
  }

  return { list, detail };
}
