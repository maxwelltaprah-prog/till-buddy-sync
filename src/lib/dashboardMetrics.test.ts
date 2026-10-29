import { describe, expect, it } from 'vitest';
import { dashboardStock, salesGrowth, type StockEntry } from './dashboardMetrics';

describe('cashier dashboard metrics', () => {
  it('calculates daily sales growth against yesterday, not profit', () => {
    expect(salesGrowth(300, 200)).toBe(50);
    expect(salesGrowth(100, 200)).toBe(-50);
    expect(salesGrowth(0, 200)).toBe(-100);
    expect(salesGrowth(300, 0)).toBeNull();
  });
  it('counts active branch products and flags stock at or below minimum, including zero', () => {
    const entry = (quantity: number, min: number, active = true, available = true): StockEntry => ({
      product_id: String(quantity), quantity, is_available: available,
      product: { name: 'Product', sku: 'SKU', min_stock_level: min, is_active: active },
    });
    const result = dashboardStock([entry(0,0),entry(5,5),entry(6,5),entry(0,5,false),entry(0,5,true,false)]);
    expect(result.totalProducts).toBe(3);
    expect(result.low.map(row => row.quantity)).toEqual([0,5]);
  });
});