import { suggestSlots } from './slot-suggestion.js';
import { stackKey, withContainerOnTop } from './stacks.js';

export function planBlockers(target, stackContainers) {
  return stackContainers
    .filter((container) => container.tier > target.tier)
    .sort((first, second) => second.tier - first.tier)
    .map((container, index) => ({ ...container, sequence: index + 1 }));
}

export function planRelocationDestinations({ blockers, blocks, stacks, sourceStack }) {
  const excludedStacks = new Set([stackKey(sourceStack)]);
  let plannedStacks = stacks;
  return blockers.map((blocker) => {
    const [best] = suggestSlots({
      container: blocker,
      blocks,
      stacks: plannedStacks,
      excludedStacks,
      limit: 1,
    });
    if (!best) {
      return { blocker, destination: null };
    }
    plannedStacks = withContainerOnTop(plannedStacks, best, blocker);
    return { blocker, destination: best };
  });
}
