import { describe, expect, it } from 'vitest';
import { savedTaxLines, transactionTaxLines } from './transactionReceipt';

describe('historical transaction taxes', () => {
  it('preserves stored sale tax rates and amounts', () => {
    const saved = [{ code: 'VAT', name: 'VAT', rate: 15, amount: 12 }];
    expect(transactionTaxLines({ tax_breakdown: saved }, [{ tax_breakdown: [{ code: 'VAT', name: 'VAT', rate: 20, amount: 16 }] }])).toEqual(saved);
  });
  it('recovers saved item taxes without calculating new tax', () => {
    const items = [0.1, 0.2].map(amount => ({ tax_breakdown: [{ code: 'NHIL', name: 'NHIL', rate: 2.5, amount }] }));
    expect(transactionTaxLines({ tax_breakdown: null }, items)).toEqual([{ code: 'NHIL', name: 'NHIL', rate: 2.5, amount: 0.3 }]);
  });
  it('does not invent tax components for legacy sales', () => {
    expect(savedTaxLines(null)).toEqual([]);
    expect(savedTaxLines([{ code: 'VAT' }])).toEqual([]);
  });
});