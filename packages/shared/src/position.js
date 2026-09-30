function padTwoDigits(value) {
  return String(value).padStart(2, '0');
}

export function formatPositionCode({ blockCode, row, bay, tier }) {
  return `${blockCode}-${padTwoDigits(row)}-${padTwoDigits(bay)}-${tier}`;
}
