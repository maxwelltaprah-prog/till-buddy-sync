export interface StockEntry {
  product_id: string;
  quantity: number | null;
  is_available: boolean;
  product: { name: string; sku: string; min_stock_level: number | null; is_active: boolean | null } | null;
}

export function dashboardStock(entries: StockEntry[]) {
  const active = entries.filter(entry => entry.is_available && entry.product?.is_active && Number(entry.quantity ?? 0) > 0);
  const low = active.filter(entry => Number(entry.quantity ?? 0) <= Number(entry.product?.min_stock_level ?? 0))
    .sort((a, b) => Number(a.quantity ?? 0) - Number(b.quantity ?? 0));
  return { totalProducts: active.length, low };
}

export function salesGrowth(today: number, yesterday: number): number | null {
  return yesterday > 0 ? ((today - yesterday) / yesterday) * 100 : null;
}
/** Admin "All branches" view: sum each product's stock across branches into one entry. */
export function consolidateBranches(entries: StockEntry[]): StockEntry[] {
  const byProduct = new Map<string, StockEntry>();
  for (const e of entries) {
    if (!e.is_available || !e.product?.is_active) continue;
    const prev = byProduct.get(e.product_id);
    byProduct.set(e.product_id, prev
      ? { ...prev, quantity: Number(prev.quantity ?? 0) + Number(e.quantity ?? 0) }
      : { ...e, quantity: Number(e.quantity ?? 0) });
  }
  return [...byProduct.values()];
}

export function totalUnits(entries: StockEntry[]): number {
  return entries.reduce((s, e) => s + Number(e.quantity ?? 0), 0);
}
