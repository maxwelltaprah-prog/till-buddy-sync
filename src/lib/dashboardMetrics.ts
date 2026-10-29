export interface StockEntry {
  product_id: string;
  quantity: number | null;
  is_available: boolean;
  product: { name: string; sku: string; min_stock_level: number | null; is_active: boolean | null } | null;
}

export function dashboardStock(entries: StockEntry[]) {
  const active = entries.filter(entry => entry.is_available && entry.product?.is_active);
  const low = active.filter(entry => Number(entry.quantity ?? 0) <= Number(entry.product?.min_stock_level ?? 0))
    .sort((a, b) => Number(a.quantity ?? 0) - Number(b.quantity ?? 0));
  return { totalProducts: active.length, low };
}

export function salesGrowth(today: number, yesterday: number): number | null {
  return yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : null;
}