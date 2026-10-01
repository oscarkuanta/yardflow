export function systemClock() {
  return new Date();
}

export function createShiftedClock(start, startedAt = Date.now()) {
  const offsetMs = start.getTime() - startedAt;
  return () => new Date(Date.now() + offsetMs);
}

export function clockFromStart(clockStart) {
  return clockStart ? createShiftedClock(new Date(clockStart)) : systemClock;
}
