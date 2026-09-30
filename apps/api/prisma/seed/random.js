export function createRandom(seed) {
  let state = seed >>> 0;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  }

  function integer(min, max) {
    return min + Math.floor(next() * (max - min + 1));
  }

  function chance(probability) {
    return next() < probability;
  }

  function pick(items) {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty list');
    }
    return items[integer(0, items.length - 1)];
  }

  function pickWeighted(weightsByValue) {
    const entries = Object.entries(weightsByValue);
    const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let remaining = next() * totalWeight;
    for (const [value, weight] of entries) {
      remaining -= weight;
      if (remaining < 0) {
        return value;
      }
    }
    return entries[entries.length - 1][0];
  }

  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = integer(0, index);
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  return { next, integer, chance, pick, pickWeighted, shuffle };
}
