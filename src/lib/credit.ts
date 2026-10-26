export type CreditStatus = 'paid' | 'current' | 'due_soon' | 'due_today' | 'overdue';

/** Days a creditor is warned before the repayment date. */
export const CREDIT_WARN_DAYS = 3;

const dayStart = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')) : new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export function addDays(from: Date, days: number): string {
  const d = dayStart(from);
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function daysToDue(dueDate: string, today: Date = new Date()): number {
  return Math.round((dayStart(dueDate).getTime() - dayStart(today).getTime()) / 86400000);
}

export function creditStatus(amount: number, paid: number, dueDate: string, today: Date = new Date()): CreditStatus {
  if (amount - paid <= 0.001) return 'paid';
  const d = daysToDue(dueDate, today);
  if (d < 0) return 'overdue';
  if (d === 0) return 'due_today';
  if (d <= CREDIT_WARN_DAYS) return 'due_soon';
  return 'current';
}

export const CREDIT_STATUS_LABEL: Record<CreditStatus, string> = {
  paid: 'Paid',
  current: 'Current',
  due_soon: 'Due soon',
  due_today: 'Due today',
  overdue: 'Overdue',
};
