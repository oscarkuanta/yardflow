export const SEED_MODES = ['always', 'if-empty', 'never'];

export function shouldSeed(mode, userCount) {
  if (!SEED_MODES.includes(mode)) {
    throw new Error(`SEED_ON_START must be one of ${SEED_MODES.join(', ')}`);
  }
  if (mode === 'always') {
    return true;
  }
  return mode === 'if-empty' && userCount === 0;
}
