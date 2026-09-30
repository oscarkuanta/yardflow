import { describe, expect, test } from '@jest/globals';
import { ContainerSize, Role, SIZE_CLASS_BY_SIZE, STAFF_ROLES, TEU_BY_SIZE } from '../src/index.js';

describe('enums', () => {
  test('maps each value to itself', () => {
    expect(Role.GATE_OPERATOR).toBe('GATE_OPERATOR');
    expect(Object.keys(ContainerSize)).toEqual(['FT20', 'FT40', 'FT45']);
  });

  test('cannot be changed at runtime', () => {
    expect(Object.isFrozen(Role)).toBe(true);
  });

  test('counts 20 ft as 1 TEU and 40 ft and 45 ft as 2 TEU', () => {
    expect(TEU_BY_SIZE).toEqual({ FT20: 1, FT40: 2, FT45: 2 });
  });

  test('puts 20 ft in SMALL blocks and 40 ft and 45 ft in LARGE blocks', () => {
    expect(SIZE_CLASS_BY_SIZE).toEqual({ FT20: 'SMALL', FT40: 'LARGE', FT45: 'LARGE' });
  });

  test('lists every role except CUSTOMER as staff', () => {
    expect(STAFF_ROLES).toEqual(['ADMIN', 'PLANNER', 'GATE_OPERATOR']);
  });
});
