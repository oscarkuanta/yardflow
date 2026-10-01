import { DAY_MS } from '../../lib/terminal-time.js';
import { createReportsService } from '../reports/reports.service.js';
import { averageGateInMinutes, maskContainerNumber, maskTruckPlate } from './public-stats.js';

export const STATS_CACHE_MS = 15000;
export const RECENT_GATE_EVENTS = 3;
const GATE_IN_SAMPLE_DAYS = 7;

export function createPublicService({ prisma, clock }) {
  const reports = createReportsService({ prisma, clock });
  let cached = null;

  async function gateInMinutes(now) {
    const gateIns = await prisma.gateTransaction.findMany({
      where: {
        direction: 'IN',
        createdAt: { gte: new Date(now.getTime() - GATE_IN_SAMPLE_DAYS * DAY_MS) },
      },
      select: { preAdviceId: true, createdAt: true },
    });
    const verifications = await prisma.auditLog.findMany({
      where: {
        action: 'GATE_TRUCK_VERIFIED',
        entity: 'PreAdvice',
        entityId: { in: gateIns.map((gateIn) => String(gateIn.preAdviceId)) },
      },
      select: { entityId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const verifiedAtByPreAdvice = new Map(
      verifications.map((entry) => [Number(entry.entityId), entry.createdAt]),
    );
    return averageGateInMinutes(gateIns, verifiedAtByPreAdvice);
  }

  async function recentGateEvents() {
    const transactions = await prisma.gateTransaction.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: RECENT_GATE_EVENTS,
      include: { container: { select: { number: true, size: true } } },
    });
    return transactions.map((transaction) => ({
      kind: transaction.direction,
      containerNumber: maskContainerNumber(transaction.container.number),
      size: transaction.container.size,
      plate: maskTruckPlate(transaction.truckPlate),
      lane: transaction.lane,
      at: transaction.createdAt,
    }));
  }

  async function computeStats(now) {
    const [kpis, gateIn, events] = await Promise.all([
      reports.kpis(),
      gateInMinutes(now),
      recentGateEvents(),
    ]);
    return {
      containersInYard: kpis.occupancy.containersInYard,
      occupancyPercent: kpis.occupancy.percent,
      gateMovesToday: kpis.gateMovesToday.total,
      averageDwellDays: kpis.averageDwellDays,
      averageGateInMinutes: gateIn,
      recentGateEvents: events,
      generatedAt: now,
    };
  }

  async function stats() {
    const now = clock();
    if (cached && now.getTime() - cached.at < STATS_CACHE_MS) {
      return cached.value;
    }
    const value = await computeStats(now);
    cached = { at: now.getTime(), value };
    return value;
  }

  return { stats };
}
