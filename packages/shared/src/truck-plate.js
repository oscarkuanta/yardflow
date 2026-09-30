export function normalizeTruckPlate(input) {
  if (typeof input !== 'string') {
    return '';
  }
  return input.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function normalizeDriverName(input) {
  if (typeof input !== 'string') {
    return '';
  }
  return input.trim().replace(/\s+/g, ' ').toLowerCase();
}
