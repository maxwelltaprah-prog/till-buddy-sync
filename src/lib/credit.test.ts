import { describe, it, expect } from 'vitest';
import { addDays, creditStatus, daysToDue } from './credit';

const today = new Date('2026-10-26T10:00:00');

describe('credit ageing', () => {
  it('due date is sale date plus repayment days', () => {
    expect(addDays(today, 30)).toBe('2026-11-25');
  });
  it('more than 3 days left is current', () => {
    expect(creditStatus(100, 0, '2026-10-30', today)).toBe('current');
  });
  it('3 days or fewer left is due soon', () => {
    expect(creditStatus(100, 0, '2026-10-29', today)).toBe('due_soon');
  });
  it('due date today is due today', () => {
    expect(creditStatus(100, 0, '2026-10-26', today)).toBe('due_today');
  });
  it('past due date is overdue', () => {
    expect(creditStatus(100, 40, '2026-10-25', today)).toBe('overdue');
    expect(daysToDue('2026-10-20', today)).toBe(-6);
  });
  it('fully repaid is paid even if past due', () => {
    expect(creditStatus(100, 100, '2026-10-01', today)).toBe('paid');
  });
});
