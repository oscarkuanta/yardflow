import { generateContainerNumber } from '@yardflow/shared';
import {
  DRIVER_FIRST_NAMES,
  DRIVER_LAST_NAMES,
  IMO_CLASSES,
  PLATE_CITY_CODES,
} from './reference-data.js';

const SIZE_WEIGHTS = { FT20: 30, FT40: 60, FT45: 10 };
const EMPTY_SIZE_WEIGHTS = { FT40: 85, FT45: 15 };
const DANGEROUS_PROBABILITY = 0.05;
const EMPTY_PROBABILITY = 0.15;
const EMPTY_TARE_KG = { FT20: 2200, FT40: 3750, FT45: 4800 };
const FULL_WEIGHT_RANGE_KG = { FT20: [8000, 26000], FT40: [10000, 28000], FT45: [12000, 29000] };
const HIGH_CUBE_PROBABILITY = { FT20: 0.05, FT40: 0.6, FT45: 1 };

export function createNumberFactory(random, reservedNumbers = []) {
  const usedNumbers = new Set(reservedNumbers);
  const nextSerialByPrefix = new Map();

  return function nextContainerNumber(companyCode) {
    const prefix = `${companyCode}U`;
    let serial = nextSerialByPrefix.get(prefix) ?? random.integer(100000, 400000);
    let number = generateContainerNumber(prefix, serial);
    while (usedNumbers.has(number)) {
      serial += 1;
      number = generateContainerNumber(prefix, serial);
    }
    usedNumbers.add(number);
    nextSerialByPrefix.set(prefix, serial + random.integer(1, 97));
    return number;
  };
}

function grossWeightKg(random, size, loadStatus) {
  if (loadStatus === 'EMPTY') {
    return EMPTY_TARE_KG[size];
  }
  const [minimum, maximum] = FULL_WEIGHT_RANGE_KG[size];
  return random.integer(minimum / 100, maximum / 100) * 100;
}

export function buildProfile(random, { size, loadStatus, isDangerous }) {
  return {
    size,
    isHighCube: random.chance(HIGH_CUBE_PROBABILITY[size]),
    loadStatus,
    isDangerous,
    imoClass: isDangerous ? random.pick(IMO_CLASSES) : null,
    grossWeightKg: grossWeightKg(random, size, loadStatus),
  };
}

export function profileForBlock(random, block, size) {
  return buildProfile(random, {
    size,
    loadStatus: block.type === 'EMPTY' ? 'EMPTY' : 'FULL',
    isDangerous: block.type === 'DG',
  });
}

export function randomProfile(random) {
  if (random.chance(DANGEROUS_PROBABILITY)) {
    return buildProfile(random, { size: 'FT20', loadStatus: 'FULL', isDangerous: true });
  }
  if (random.chance(EMPTY_PROBABILITY)) {
    const size = random.pickWeighted(EMPTY_SIZE_WEIGHTS);
    return buildProfile(random, { size, loadStatus: 'EMPTY', isDangerous: false });
  }
  const size = random.pickWeighted(SIZE_WEIGHTS);
  return buildProfile(random, { size, loadStatus: 'FULL', isDangerous: false });
}

function randomLetters(random, count) {
  return Array.from({ length: count }, () => String.fromCharCode(random.integer(65, 90))).join('');
}

export function randomTruckPlate(random) {
  return `${random.pick(PLATE_CITY_CODES)}-${randomLetters(random, 2)} ${random.integer(10, 9999)}`;
}

export function randomDriverName(random) {
  return `${random.pick(DRIVER_FIRST_NAMES)} ${random.pick(DRIVER_LAST_NAMES)}`;
}

export function randomPin(random) {
  return String(random.integer(100000, 999999));
}
