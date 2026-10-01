export const IMAGE_WIDTHS = {
  'night-harbor': 1600,
  'aerial-stacks': 1400,
  'aerial-cranes': 1400,
  'crane-truck': 1200,
  'ship-cranes': 1600,
  'crane-stacks': 1200,
  'yard-lane': 1200,
  'sunset-truck': 1600,
};

const SMALL_WIDTH = 800;

export function imageSource(name) {
  return `/images/${name}-${SMALL_WIDTH}.jpg`;
}

export function imageSourceSet(name) {
  return [
    `/images/${name}-${SMALL_WIDTH}.jpg ${SMALL_WIDTH}w`,
    `/images/${name}-1600.jpg ${IMAGE_WIDTHS[name]}w`,
  ].join(', ');
}
