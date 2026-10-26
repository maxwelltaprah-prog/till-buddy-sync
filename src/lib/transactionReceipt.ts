import type { Json, Tables } from '@/integrations/supabase/types';
import type { ReceiptData, ShopBranding } from '@/lib/receiptGenerator';
import { receiptCashierName } from '@/lib/cashier';
import type { TaxLine } from '@/lib/tax';

/** Read historical tax amounts, never recompute them using today's settings. */
export function savedTaxLines(value: Json | null): TaxLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(line => {
    if (!line || typeof line !== 'object' || Array.isArray(line)) return [];
    if (typeof line.code !== 'string' || typeof line.name !== 'string' ||
        typeof line.rate !== 'number' || typeof line.amount !== 'number') return [];
    return [{ code: line.code, name: line.name, rate: line.rate, amount: line.amount }];
  });
}

export function transactionTaxLines(sale: Pick<Tables<'sales'>, 'tax_breakdown'>, items: Pick<Tables<'sale_items'>, 'tax_breakdown'>[]): TaxLine[] {
  const saved = savedTaxLines(sale.tax_breakdown);
  if (saved.length) return saved;
  const totals = new Map<string, TaxLine>();
  items.flatMap(item => savedTaxLines(item.tax_breakdown)).forEach(line => {
    const key = `${line.code}:${line.rate}`;
    const previous = totals.get(key);
    totals.set(key, { ...line, amount: Math.round(((previous?.amount || 0) + line.amount) * 100) / 100 });
  });
  return Array.from(totals.values());
}

export function transactionReceipt(
  sale: Tables<'sales'>,
  items: Tables<'sale_items'>[],
  branch: Pick<Tables<'branches'>, 'name' | 'address'>,
  cashierName: string | null,
  branding: ShopBranding,
  credit?: ReceiptData['credit'],
): ReceiptData {
  if (!sale.created_at || !Number.isFinite(new Date(sale.created_at).getTime())) throw new Error('The sale date is unavailable.');
  if (sale.payment_method === 'credit' && !credit) throw new Error('Credit details are unavailable.');
  return {
    receiptNumber: sale.receipt_number, date: new Date(sale.created_at),
    branchName: branch.name, branchAddress: branch.address || '',
    cashierName: receiptCashierName(cashierName),
    items: items.map(item => ({ name: item.product_name, quantity: item.quantity, unitPrice: item.unit_price, total: item.total, isBulk: Boolean(item.is_bulk_price) })),
    subtotal: sale.subtotal, discountAmount: sale.discount_amount || 0,
    taxAmount: sale.tax_amount || 0, taxLines: transactionTaxLines(sale, items), total: sale.total,
    cashReceived: sale.cash_received || 0, change: sale.change_given || 0, branding, credit,
  };
}