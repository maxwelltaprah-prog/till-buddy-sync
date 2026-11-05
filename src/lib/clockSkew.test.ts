import { describe, it, expect } from 'vitest';
import { clockSkewSeconds } from './clockSkew';

const token = (iat: number) => `h.${btoa(JSON.stringify({ iat }))}.s`;

describe('clockSkewSeconds', () => {
  it('reports a clock one hour ahead as +3600', () => {
    expect(clockSkewSeconds(token(1000), (1000 + 3600) * 1000)).toBe(3600);
  });
  it('reports a clock behind as negative', () => {
    expect(clockSkewSeconds(token(5000), 4400 * 1000)).toBe(-600);
  });
  it('returns null for a bad token', () => {
    expect(clockSkewSeconds('bad')).toBeNull();
  });
});
