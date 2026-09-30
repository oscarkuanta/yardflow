const POSITION_CODE_PATTERN = /^([A-Z][A-Z0-9]?)-(\d{2})-(\d{2})(?:-(\d))?$/;

function padTwoDigits(value) {
  return String(value).padStart(2, '0');
}

export function formatStackCode({ blockCode, row, bay }) {
  return `${blockCode}-${padTwoDigits(row)}-${padTwoDigits(bay)}`;
}

export function formatPositionCode({ blockCode, row, bay, tier }) {
  return `${formatStackCode({ blockCode, row, bay })}-${tier}`;
}

export function parsePositionCode(input) {
  if (typeof input !== 'string') {
    return null;
  }
  const match = POSITION_CODE_PATTERN.exec(input.trim().toUpperCase());
  if (!match) {
    return null;
  }
  const [, blockCode, row, bay, tier] = match;
  return {
    blockCode,
    row: Number(row),
    bay: Number(bay),
    tier: tier === undefined ? null : Number(tier),
  };
}
