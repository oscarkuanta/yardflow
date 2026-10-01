import { normalizeContainerNumber, normalizeTruckPlate } from '@yardflow/shared';

const MASK = '•';

export function maskTruckPlate(plate) {
  const normalized = normalizeTruckPlate(plate);
  const [region, ...rest] = normalized.split('-');
  const tail = rest.join('-');
  if (!tail) {
    return `${MASK.repeat(Math.max(0, normalized.length - 1))}${normalized.slice(-1)}`;
  }
  const maskedTail = tail.replace(/[A-Z0-9]/g, MASK).slice(0, -1) + tail.slice(-1);
  return `${region}-${maskedTail}`;
}

export function maskContainerNumber(number) {
  const normalized = normalizeContainerNumber(number);
  return `${normalized.slice(0, 4)} ${MASK.repeat(3)}${normalized.slice(7, 10)} ${normalized.slice(10)}`;
}

export function averageGateInMinutes(gateIns, verifiedAtByPreAdvice) {
  const minutes = gateIns
    .map((gateIn) => {
      const verifiedAt = verifiedAtByPreAdvice.get(gateIn.preAdviceId);
      return verifiedAt ? (gateIn.createdAt - verifiedAt) / 60000 : null;
    })
    .filter((value) => value !== null && value >= 0);
  if (minutes.length === 0) {
    return null;
  }
  return Math.round((minutes.reduce((sum, value) => sum + value, 0) / minutes.length) * 10) / 10;
}
