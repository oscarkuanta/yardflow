export const CONTAINER_NUMBER_PATTERN = /^[A-Z]{3}[UJZ]\d{7}$/;
export const OWNER_PREFIX_PATTERN = /^[A-Z]{3}[UJZ]$/;
export const INVALID_FORMAT_MESSAGE = 'Invalid container number format';
export const INVALID_CHECK_DIGIT_MESSAGE = 'Invalid container number: check digit does not match';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SERIAL_LENGTH = 6;
const MAX_SERIAL = 999999;

function buildLetterValues() {
  const values = {};
  let nextValue = 10;
  for (const letter of ALPHABET) {
    if (nextValue % 11 === 0) {
      nextValue += 1;
    }
    values[letter] = nextValue;
    nextValue += 1;
  }
  return values;
}

const LETTER_VALUES = buildLetterValues();

export function letterValue(letter) {
  const value = LETTER_VALUES[letter];
  if (value === undefined) {
    throw new Error(`Not an uppercase letter: ${letter}`);
  }
  return value;
}

function characterValue(character) {
  if (/\d/.test(character)) {
    return Number(character);
  }
  return letterValue(character);
}

export function normalizeContainerNumber(input) {
  if (typeof input !== 'string') {
    return '';
  }
  return input.replace(/\s+/g, '').toUpperCase();
}

export function computeWeightedSum(firstTenCharacters) {
  if (!/^[A-Z]{4}\d{6}$/.test(firstTenCharacters)) {
    throw new Error(`Expected 4 letters and 6 digits: ${firstTenCharacters}`);
  }
  return [...firstTenCharacters].reduce(
    (sum, character, position) => sum + characterValue(character) * 2 ** position,
    0,
  );
}

export function computeCheckDigit(firstTenCharacters) {
  return (computeWeightedSum(firstTenCharacters) % 11) % 10;
}

export function getContainerNumberError(input) {
  const number = normalizeContainerNumber(input);
  if (!CONTAINER_NUMBER_PATTERN.test(number)) {
    return INVALID_FORMAT_MESSAGE;
  }
  const expectedCheckDigit = computeCheckDigit(number.slice(0, 10));
  if (Number(number[10]) !== expectedCheckDigit) {
    return INVALID_CHECK_DIGIT_MESSAGE;
  }
  return null;
}

export function isValidContainerNumber(input) {
  return getContainerNumberError(input) === null;
}

export function formatContainerNumber(input) {
  const number = normalizeContainerNumber(input);
  if (number.length !== 11) {
    return number;
  }
  return `${number.slice(0, 4)} ${number.slice(4, 10)} ${number.slice(10)}`;
}

export function generateContainerNumber(ownerPrefix, serial) {
  if (!OWNER_PREFIX_PATTERN.test(ownerPrefix)) {
    throw new Error(`Invalid owner prefix: ${ownerPrefix}`);
  }
  if (!Number.isInteger(serial) || serial < 0 || serial > MAX_SERIAL) {
    throw new Error(`Serial must be an integer from 0 to ${MAX_SERIAL}: ${serial}`);
  }
  const firstTenCharacters = ownerPrefix + String(serial).padStart(SERIAL_LENGTH, '0');
  return firstTenCharacters + computeCheckDigit(firstTenCharacters);
}
