import { describe, expect, it } from 'vitest';
import { receiptCashierName } from './cashier';

describe('receipt cashier identity', () => {
  it('uses the cashier full name', () => {
    expect(receiptCashierName('Maxwell Taprah')).toBe('Maxwell Taprah');
  });
  it('does not substitute an email when the name is missing', () => {
    expect(receiptCashierName(null)).toBe('Cashier');
  });
});