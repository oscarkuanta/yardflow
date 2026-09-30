export function stackKey({ blockCode, row, bay }) {
  return `${blockCode}-${row}-${bay}`;
}

export function emptyStack({ blockCode, row, bay }) {
  return { blockCode, row, bay, height: 0, topSize: null, topOwnerCompanyId: null, containers: [] };
}

export function describeStack(address, containersBottomUp) {
  const top = containersBottomUp.at(-1);
  return {
    ...address,
    height: containersBottomUp.length,
    topSize: top?.size ?? null,
    topOwnerCompanyId: top?.ownerCompanyId ?? null,
    containers: containersBottomUp,
  };
}

export function buildStacks(blocks, positions) {
  const blockCodeById = new Map(blocks.map((block) => [block.id, block.code]));
  const containersByStack = new Map();
  for (const position of positions) {
    const address = {
      blockCode: blockCodeById.get(position.blockId),
      row: position.row,
      bay: position.bay,
    };
    const key = stackKey(address);
    const entry = containersByStack.get(key) ?? { address, containers: [] };
    entry.containers.push({ ...position.container, tier: position.tier });
    containersByStack.set(key, entry);
  }
  const stacks = new Map();
  for (const [key, { address, containers }] of containersByStack) {
    stacks.set(
      key,
      describeStack(
        address,
        containers.sort((first, second) => first.tier - second.tier),
      ),
    );
  }
  return stacks;
}

export function stackAt(stacks, address) {
  return stacks.get(stackKey(address)) ?? emptyStack(address);
}

export function withContainerOnTop(stacks, address, container) {
  const current = stackAt(stacks, address);
  const updated = new Map(stacks);
  updated.set(
    stackKey(address),
    describeStack(address, [...current.containers, { ...container, tier: current.height + 1 }]),
  );
  return updated;
}
