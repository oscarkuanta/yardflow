import { describe, expect, test } from '@jest/globals';
import { containerNumberSchema } from '../src/index.js';

describe('containerNumberSchema', () => {
  test('normalizes a valid number', () => {
    expect(containerNumberSchema.parse('hnfu 204571 1')).toBe('HNFU2045711');
  });

  test.each([
    ['HNFU2045712', 'Invalid container number: check digit does not match'],
    ['HNF2045711', 'Invalid container number format'],
  ])('rejects %s with the spec message', (input, message) => {
    const result = containerNumberSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toBe(message);
  });

  test('rejects a value that is not a string', () => {
    expect(containerNumberSchema.safeParse(12345).success).toBe(false);
  });
});
