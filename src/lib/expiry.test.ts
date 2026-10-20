import { describe, it, expect } from 'vitest';
import { ageBucket, DEFAULT_THRESHOLDS as th } from './expiry';

const today = new Date(2026, 0, 15);

describe('expiry ageing 3/4/6 months', () => {
  it('past date is expired', () => expect(ageBucket('2026-01-14', th, today)).toBe('expired'));
  it('within 3 months', () => expect(ageBucket('2026-04-10', th, today)).toBe('b1'));
  it('3 to 4 months', () => expect(ageBucket('2026-05-10', th, today)).toBe('b2'));
  it('4 to 6 months', () => expect(ageBucket('2026-07-10', th, today)).toBe('b3'));
  it('over 6 months', () => expect(ageBucket('2026-08-01', th, today)).toBe('safe'));
});
