import { describe, it, expect } from 'vitest';
import { calculateTaxes } from './tax';

const ghana = [
  { name: 'VAT', code: 'VAT', rate: 15 },
  { name: 'NHIL', code: 'NHIL', rate: 2.5 },
  { name: 'GETFund', code: 'GETFUND', rate: 2.5 },
];

describe('Ghana decoupled tax', () => {
  it('total effective rate is 20%', () => {
    expect(calculateTaxes(100, ghana).effectiveRate).toBe(20);
  });
  it('100 taxable gives VAT 15, NHIL 2.5, GETFund 2.5, total 20', () => {
    const r = calculateTaxes(100, ghana);
    expect(r.lines.map((l) => l.amount)).toEqual([15, 2.5, 2.5]);
    expect(r.total).toBe(20);
  });
  it('inactive components are skipped', () => {
    expect(calculateTaxes(100, [...ghana.slice(0, 2), { ...ghana[2], is_active: false }]).total).toBe(17.5);
  });
});
