import { formatContainerNumber } from '@yardflow/shared';
import { DAY_MS } from '../../lib/terminal-time.js';
import { positionCodeOf } from '../yard/placement.js';

export function dwellDays(container, now) {
  if (container.state !== 'IN_YARD' || !container.gateInAt) {
    return null;
  }
  return Math.max(1, Math.ceil((now.getTime() - container.gateInAt.getTime()) / DAY_MS));
}

export function toContainerSummary(container, now) {
  return {
    id: container.id,
    number: container.number,
    displayNumber: formatContainerNumber(container.number),
    size: container.size,
    isHighCube: container.isHighCube,
    loadStatus: container.loadStatus,
    isDangerous: container.isDangerous,
    imoClass: container.imoClass,
    grossWeightKg: container.grossWeightKg,
    state: container.state,
    gateInAt: container.gateInAt,
    departedAt: container.departedAt,
    dwellDays: dwellDays(container, now),
    owner: container.ownerCompany,
    positionCode: container.position ? positionCodeOf(container.position) : null,
    hasHold: container.holds.some((hold) => hold.releasedAt === null),
  };
}

function toHold(hold, showStaffDetails) {
  return {
    id: hold.id,
    reason: hold.reason,
    placedAt: hold.placedAt,
    releasedAt: hold.releasedAt,
    isActive: hold.releasedAt === null,
    ...(showStaffDetails && { placedBy: hold.placedBy, releasedBy: hold.releasedBy }),
  };
}

function toInvoice(invoice) {
  return {
    id: invoice.id,
    number: invoice.number,
    periodFrom: invoice.periodFrom,
    periodTo: invoice.periodTo,
    days: invoice.days,
    freeDays: invoice.freeDays,
    chargeableDays: invoice.chargeableDays,
    dailyRateCents: invoice.dailyRateCents,
    amountCents: invoice.amountCents,
    status: invoice.status,
    paidAt: invoice.paidAt,
  };
}

function toMovement(movement, showStaffDetails) {
  return {
    type: movement.type,
    fromPosition: movement.fromPosition,
    toPosition: movement.toPosition,
    at: movement.createdAt,
    ...(showStaffDetails && { by: movement.user }),
  };
}

export function toContainerDetail(container, { now, showStaffDetails, openWorkOrders }) {
  return {
    ...toContainerSummary(container, now),
    holds: container.holds.map((hold) => toHold(hold, showStaffDetails)),
    invoices: container.invoices.map(toInvoice),
    history: container.movements.map((movement) => toMovement(movement, showStaffDetails)),
    ...(showStaffDetails && { openWorkOrders }),
  };
}
