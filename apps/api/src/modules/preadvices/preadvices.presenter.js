import { formatContainerNumber } from '@yardflow/shared';
import { dbDateToCalendarDate, formatCalendarDate } from '../../lib/terminal-time.js';
import { slotWindow } from './pre-advice-window.js';

export const PRE_ADVICE_INCLUDE = {
  timeSlot: true,
  company: { select: { id: true, code: true, name: true } },
};

export function toPreAdviceResponse(preAdvice, toleranceMin) {
  const window = slotWindow(preAdvice.timeSlot, toleranceMin);
  return {
    id: preAdvice.id,
    reference: preAdvice.reference,
    type: preAdvice.type,
    status: preAdvice.status,
    containerNumber: preAdvice.containerNumber,
    displayNumber: formatContainerNumber(preAdvice.containerNumber),
    size: preAdvice.size,
    isHighCube: preAdvice.isHighCube,
    loadStatus: preAdvice.loadStatus,
    isDangerous: preAdvice.isDangerous,
    imoClass: preAdvice.imoClass,
    grossWeightKg: preAdvice.grossWeightKg,
    truckPlate: preAdvice.truckPlate,
    driverName: preAdvice.driverName,
    company: preAdvice.company,
    timeSlot: {
      id: preAdvice.timeSlot.id,
      date: formatCalendarDate(dbDateToCalendarDate(preAdvice.timeSlot.date)),
      startHour: preAdvice.timeSlot.startHour,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
    },
    gateWindow: { opensAt: window.opensAt, closesAt: window.closesAt },
    createdAt: preAdvice.createdAt,
  };
}

export function toInvoiceSummary(invoice) {
  return invoice
    ? {
        id: invoice.id,
        number: invoice.number,
        periodFrom: invoice.periodFrom,
        periodTo: invoice.periodTo,
        chargeableDays: invoice.chargeableDays,
        amountCents: invoice.amountCents,
        status: invoice.status,
      }
    : null;
}
