import { DAY_MS } from '../../lib/terminal-time.js';

export function calculateStorageFee(gateInAt, periodTo, tariff) {
  if (periodTo.getTime() < gateInAt.getTime()) {
    throw new Error('periodTo must not be before gateInAt');
  }
  const days = Math.max(1, Math.ceil((periodTo.getTime() - gateInAt.getTime()) / DAY_MS));
  const chargeableDays = Math.max(0, days - tariff.freeDays);
  return {
    days,
    freeDays: tariff.freeDays,
    chargeableDays,
    dailyRateCents: tariff.dailyRateCents,
    amountCents: chargeableDays * tariff.dailyRateCents,
  };
}

export function calculateExtensionFee(gateInAt, billedUntil, periodTo, tariff) {
  if (periodTo.getTime() < billedUntil.getTime()) {
    throw new Error('periodTo must not be before billedUntil');
  }
  const total = calculateStorageFee(gateInAt, periodTo, tariff);
  const billed = calculateStorageFee(gateInAt, billedUntil, tariff);
  const days = total.days - billed.days;
  const chargeableDays = total.chargeableDays - billed.chargeableDays;
  return {
    days,
    freeDays: days - chargeableDays,
    chargeableDays,
    dailyRateCents: tariff.dailyRateCents,
    amountCents: chargeableDays * tariff.dailyRateCents,
  };
}
