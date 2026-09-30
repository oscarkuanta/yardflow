import { normalizeDriverName, normalizeTruckPlate } from '@yardflow/shared';

export const CHECK_KEYS = ['PRE_ADVICE', 'TRUCK_DRIVER', 'CUSTOMS', 'INVOICE'];

function check(key, passed, message) {
  return { key, passed, message };
}

function preAdviceCheck(preAdvice, now) {
  if (!preAdvice || preAdvice.type !== 'PICKUP' || preAdvice.status !== 'ACTIVE') {
    return check('PRE_ADVICE', false, 'No active pickup pre-advice for this truck');
  }
  if (now < preAdvice.window.opensAt || now > preAdvice.window.closesAt) {
    return check('PRE_ADVICE', false, 'The truck is outside its booked time slot');
  }
  return check('PRE_ADVICE', true, `Pre-advice ${preAdvice.reference} is valid for this slot`);
}

function truckDriverCheck(preAdvice, { truckPlate, driverName }) {
  if (!preAdvice) {
    return check('TRUCK_DRIVER', false, 'No pre-advice to compare with');
  }
  const plateMatches =
    normalizeTruckPlate(truckPlate) === normalizeTruckPlate(preAdvice.truckPlate);
  const driverMatches =
    normalizeDriverName(driverName) === normalizeDriverName(preAdvice.driverName);
  if (!plateMatches) {
    return check('TRUCK_DRIVER', false, 'Truck plate does not match the pre-advice');
  }
  if (!driverMatches) {
    return check('TRUCK_DRIVER', false, 'Driver name does not match the pre-advice');
  }
  return check('TRUCK_DRIVER', true, 'Truck plate and driver match the pre-advice');
}

function customsCheck(activeHold) {
  if (activeHold) {
    return check('CUSTOMS', false, `Active customs hold: ${activeHold.reason}`);
  }
  return check('CUSTOMS', true, 'No active customs hold');
}

function invoiceCheck(invoice, now) {
  if (!invoice) {
    return check('INVOICE', false, 'No storage invoice for this pickup');
  }
  if (invoice.status !== 'PAID') {
    return check('INVOICE', false, `Storage invoice ${invoice.number} is not paid`);
  }
  if (invoice.periodTo < now) {
    return check('INVOICE', false, `Storage invoice ${invoice.number} does not cover today`);
  }
  return check('INVOICE', true, `Storage invoice ${invoice.number} is paid`);
}

export function runGateOutChecks({ preAdvice, truckPlate, driverName, activeHold, invoice, now }) {
  const checks = [
    preAdviceCheck(preAdvice, now),
    truckDriverCheck(preAdvice, { truckPlate, driverName }),
    customsCheck(activeHold),
    invoiceCheck(invoice, now),
  ];
  return { passed: checks.every((item) => item.passed), checks };
}
