import { describe, expect, test } from '@jest/globals';
import { $Enums } from '@prisma/client';
import * as sharedEnums from '@yardflow/shared';

const ENUM_NAMES = Object.keys($Enums);

describe('shared enums', () => {
  test('cover every enum in the Prisma schema', () => {
    expect(ENUM_NAMES.length).toBeGreaterThan(0);
    for (const enumName of ENUM_NAMES) {
      expect(sharedEnums[enumName]).toBeDefined();
    }
  });

  test.each(ENUM_NAMES)('%s has the same values as the Prisma schema', (enumName) => {
    expect(Object.values(sharedEnums[enumName])).toEqual(Object.values($Enums[enumName]));
  });
});
