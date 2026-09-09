import { describe, expect, it } from 'vitest';
import { formatTonQuantity } from './quantity';

describe('formatTonQuantity', () => {
  it('removes insignificant decimal places from whole TON values', () => {
    expect(formatTonQuantity(500)).toBe('500 TON');
    expect(formatTonQuantity(1000)).toBe('1,000 TON');
  });

  it('preserves meaningful physical quantity precision', () => {
    expect(formatTonQuantity(500.5)).toBe('500.5 TON');
    expect(formatTonQuantity(500.25)).toBe('500.25 TON');
  });
});
