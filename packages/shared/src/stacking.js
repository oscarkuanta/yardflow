import { BlockType, LoadStatus, SIZE_CLASS_BY_SIZE } from './enums.js';

export function requiredBlockType({ loadStatus, isDangerous }) {
  if (isDangerous) {
    return BlockType.DG;
  }
  return loadStatus === LoadStatus.EMPTY ? BlockType.EMPTY : BlockType.STANDARD;
}

export function requiredSizeClass({ size }) {
  return SIZE_CLASS_BY_SIZE[size];
}
