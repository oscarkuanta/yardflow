export const TEU_PER_SLOT = { SMALL: 1, LARGE: 2 };

export function slotCount({ rows, bays, maxTier }) {
  return rows * bays * maxTier;
}

export function describeOccupancy(block, usedSlots) {
  const capacitySlots = slotCount(block);
  const teuPerSlot = TEU_PER_SLOT[block.sizeClass];
  return {
    capacitySlots,
    usedSlots,
    freeSlots: capacitySlots - usedSlots,
    occupancyPercent: capacitySlots === 0 ? 0 : Math.round((usedSlots / capacitySlots) * 1000) / 10,
    teuCapacity: capacitySlots * teuPerSlot,
    teuUsed: usedSlots * teuPerSlot,
  };
}

export function positionsOutside({ rows, bays, maxTier }, positions) {
  return positions.filter(
    (position) => position.row > rows || position.bay > bays || position.tier > maxTier,
  );
}

export function changesStackingClass(block, changes) {
  return (
    (changes.type !== undefined && changes.type !== block.type) ||
    (changes.sizeClass !== undefined && changes.sizeClass !== block.sizeClass)
  );
}
