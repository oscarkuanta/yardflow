import { normalizeContainerNumber } from '@yardflow/shared';

export const GATE_IN_STEPS = ['Truck', 'Container', 'Inspection', 'Slot', 'Confirm'];
export const GATE_OUT_STEPS = ['Truck', 'Checks', 'Confirm'];
export const DAMAGE_SIDES = ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'FLOOR'];
export const DAMAGE_CODES = ['DENT', 'HOLE', 'RUST', 'BROKEN', 'MISSING'];

export function stepStatuses(steps, doneCount) {
  return steps.map((label, index) => {
    if (index < doneCount) {
      return { label, status: 'done' };
    }
    return { label, status: index === doneCount ? 'active' : 'todo' };
  });
}

export function containerMatches(typedNumber, preAdvice) {
  return normalizeContainerNumber(typedNumber) === preAdvice.containerNumber;
}

export function inspectionComplete({ noDamage, damages }) {
  return noDamage || damages.length > 0;
}

export function gateInDoneCount({ preAdvice, typedNumber, inspection, selectedSlot }) {
  const checks = [
    Boolean(preAdvice),
    Boolean(preAdvice) && containerMatches(typedNumber, preAdvice),
    inspectionComplete(inspection),
    Boolean(selectedSlot),
  ];
  const firstOpen = checks.indexOf(false);
  return firstOpen === -1 ? checks.length : firstOpen;
}

export function gateOutDoneCount({ preAdvice, checkResult }) {
  if (!preAdvice) {
    return 0;
  }
  return checkResult?.canComplete ? 2 : 1;
}

export function toggleDamage(damages, side, code) {
  const exists = damages.some((damage) => damage.side === side && damage.code === code);
  if (exists) {
    return damages.filter((damage) => !(damage.side === side && damage.code === code));
  }
  return [...damages, { side, code }];
}

export function damagedSides(damages) {
  return new Set(damages.map((damage) => damage.side));
}

export function damageReports(damages, note) {
  const trimmed = note.trim();
  return damages.map((damage) => (trimmed ? { ...damage, note: trimmed } : damage));
}

export function gateInBody({ preAdvice, typedNumber, lane, inspection, selectedSlot }) {
  return {
    preAdviceId: preAdvice.id,
    containerNumber: normalizeContainerNumber(typedNumber),
    lane,
    noDamage: inspection.noDamage,
    damages: inspection.noDamage ? [] : damageReports(inspection.damages, inspection.note),
    to: selectedSlot,
  };
}

export function withLatestStatus(relocations, updates) {
  const statusById = new Map(updates.map((update) => [update.id, update.status]));
  return relocations.map((order) => ({
    ...order,
    status: statusById.get(order.id) ?? order.status,
  }));
}

export function relocationsPending(relocations, updates) {
  if (!relocations?.length) {
    return 0;
  }
  return withLatestStatus(relocations, updates).filter((order) => order.status === 'OPEN').length;
}

export function slotLabel(timeSlot) {
  const start = String(timeSlot.startHour).padStart(2, '0');
  const end = String(timeSlot.startHour + 1).padStart(2, '0');
  return `${start}:00–${end}:00`;
}

export function formatContainerParts(containerNumber) {
  return {
    owner: containerNumber.slice(0, 4),
    serial: containerNumber.slice(4, 10),
    checkDigit: containerNumber.slice(10),
  };
}
