import { describe, it, expect } from 'vitest';
import { normalizeUnit } from './units';
describe('normalizeUnit', () => {
  it('accepts template labels', () => {
    expect(normalizeUnit('Pieces')).toBe('pcs');
    expect(normalizeUnit('Kilograms')).toBe('kg');
    expect(normalizeUnit('Grams')).toBe('g');
    expect(normalizeUnit('Liters')).toBe('l');
    expect(normalizeUnit('Milliliters')).toBe('ml');
    expect(normalizeUnit('Meter')).toBe('m');
    expect(normalizeUnit('Centimeter')).toBe('cm');
    expect(normalizeUnit('Bottles')).toBe('bottle');
  });
  it('rejects unknown', () => expect(normalizeUnit('banana')).toBeNull());
});
