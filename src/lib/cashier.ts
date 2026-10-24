export function receiptCashierName(fullName?: string | null): string {
  return fullName?.trim() || 'Cashier';
}