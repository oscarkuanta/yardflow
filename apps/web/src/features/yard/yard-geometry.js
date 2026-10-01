export const MAP_SCALE_X = 2.8;
export const MAP_SCALE_Y = 6;
export const GATE_AREA_WIDTH = 150;
export const MAP_PADDING = 24;
export const LABEL_HEIGHT = 34;
export const CELL_GAP = 3;
export const CELL_SIZES = {
  SMALL: { width: 22, height: 30 },
  LARGE: { width: 34, height: 30 },
};
export const SHADE_OPACITY = [0.2, 0.45, 0.7, 1];

export function shadeLevel(height, maxTier) {
  if (height <= 0) {
    return 0;
  }
  return Math.min(SHADE_OPACITY.length, Math.ceil((height / maxTier) * SHADE_OPACITY.length));
}

export function stackFill(stack, maxTier) {
  if (stack.hasHold) {
    return { color: 'var(--danger)', opacity: 0.85 };
  }
  const level = shadeLevel(stack.height, maxTier);
  if (level === 0) {
    return { color: 'var(--surface-2)', opacity: 1 };
  }
  return { color: 'var(--accent)', opacity: SHADE_OPACITY[level - 1] };
}

export function layoutBlock(block, origin = { mapX: 0, mapY: 0 }) {
  const cell = CELL_SIZES[block.sizeClass];
  const x = GATE_AREA_WIDTH + (block.mapX - origin.mapX) * MAP_SCALE_X;
  const y = MAP_PADDING + LABEL_HEIGHT + (block.mapY - origin.mapY) * MAP_SCALE_Y;
  const stacksByKey = new Map(block.stacks.map((stack) => [`${stack.row}-${stack.bay}`, stack]));
  const cells = [];
  for (let row = 1; row <= block.rows; row += 1) {
    for (let bay = 1; bay <= block.bays; bay += 1) {
      cells.push({
        row,
        bay,
        x: x + (bay - 1) * (cell.width + CELL_GAP),
        y: y + (row - 1) * (cell.height + CELL_GAP),
        width: cell.width,
        height: cell.height,
        stack: stacksByKey.get(`${row}-${bay}`) ?? {
          row,
          bay,
          stackCode: `${block.code}-${String(row).padStart(2, '0')}-${String(bay).padStart(2, '0')}`,
          height: 0,
          topSize: null,
          hasHold: false,
          hasDangerous: false,
        },
      });
    }
  }
  return {
    block,
    x,
    y,
    width: block.bays * (cell.width + CELL_GAP) - CELL_GAP,
    height: block.rows * (cell.height + CELL_GAP) - CELL_GAP,
    cells,
  };
}

export function layoutYard(blocks) {
  if (blocks.length === 0) {
    return { layouts: [], width: GATE_AREA_WIDTH + MAP_PADDING, height: 240 };
  }
  const origin = {
    mapX: Math.min(...blocks.map((block) => block.mapX)),
    mapY: Math.min(...blocks.map((block) => block.mapY)),
  };
  const layouts = blocks.map((block) => layoutBlock(block, origin));
  const right = Math.max(GATE_AREA_WIDTH, ...layouts.map((layout) => layout.x + layout.width));
  const bottom = Math.max(240, ...layouts.map((layout) => layout.y + layout.height));
  return { layouts, width: right + MAP_PADDING, height: bottom + MAP_PADDING };
}

export function yardTotals(blocks) {
  const teuUsed = blocks.reduce((sum, block) => sum + block.occupancy.teuUsed, 0);
  const teuCapacity = blocks.reduce((sum, block) => sum + block.occupancy.teuCapacity, 0);
  const stacksOnHold = blocks.reduce(
    (sum, block) => sum + block.stacks.filter((stack) => stack.hasHold).length,
    0,
  );
  return {
    teuUsed,
    teuCapacity,
    percent: teuCapacity === 0 ? 0 : Math.round((teuUsed / teuCapacity) * 1000) / 10,
    stacksOnHold,
  };
}

export function stackCodeOfPosition(positionCode) {
  return positionCode ? positionCode.split('-').slice(0, 3).join('-') : null;
}

export function parseStackCode(stackCode) {
  const [block, row, bay] = stackCode.split('-');
  return { block, row: Number(row), bay: Number(bay) };
}
