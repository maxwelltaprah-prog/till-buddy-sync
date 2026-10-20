# POS Enhancements: Profit, Expiry, Ghana Tax, Pagination, Bulk Import, Multi-Location Stock

## 1. Daily Profit Report
- New "Profit" tab in Reports: revenue, cost of goods sold, gross profit, margin % for today / date range.
- Per-product profit table (qty sold, revenue, cost, profit).
- Cost captured on each sale line at time of sale so later cost changes don't rewrite history.
- Dashboard card: "Today's Profit".

## 2. Shelf Life (Mfg / Expiry Dates)
- Stock is received in batches: each receipt records batch number, manufacturing date, expiry date, quantity.
- Product form gets a default shelf life (days) to auto-suggest expiry from mfg date.
- Shows days remaining (expiry date vs today) on inventory.

## 3. Expiry Ageing
- New "Expiry Ageing" page with buckets: Expired, within 3 months, 3–4 months, 4–6 months, over 6 months.
- Admin can adjust the bucket thresholds (default 3/4/6) in Settings.
- Colour-coded badges; POS warns when selling an expired batch.

## 4. Ghana Tax (Admin-Editable)
- Tax settings page with a list of tax components (name, rate, active):
  - VAT 15.0%, NHIL 2.5%, GETFund 2.5% — total 20.0%.
- Decoupled method: each component calculated on the taxable subtotal and summed.
- Admin can edit rates, add/remove components for future changes.
- POS cart, receipts and reports show each component separately.

## 5. POS Display & Pagination
- POS product view toggle: Grid / List / Compact, remembered per device.
- Pagination (page size selector) on POS products, Products, Categories, Inventory, Stock Movements.

## 6. Bulk Product Import
- Upload CSV or Excel; downloadable template.
- Preview with row-level validation errors before import; match categories/suppliers by name; update existing products by SKU.
- Optional opening stock + mfg/expiry per row.

## 7. Multiple Locations (Warehouses + Sales Points)
- Branches gain a type: Warehouse or Sales Point.
- Stock tracked per location; stock movement page filters by location.
- Stock Transfer screen: admin/stock manager moves quantities (by batch) from one location to another, recorded as transfer out / transfer in in one step.
- Transfer history list.

## 8. Users & Products per Sales Point
- Assign each user to a sales point (already partially present; made editable in Users page).
- Cashiers only see and sell stock from their assigned sales point; POS blocks selling beyond available stock there.
- Products can be enabled/disabled per sales point.

## Technical Details
- New tables: `tax_components`, `product_batches`, `stock_transfers` (+ items); new columns: `products.shelf_life_days`, `sale_items.cost_price`, `sale_items.tax_breakdown`, `branches.location_type`, `branch_inventory.is_available`.
- Atomic DB function `transfer_stock` (locks rows, validates qty, writes both movements).
- Expiry thresholds stored in `system_settings` (`expiry_ageing`).
- Bulk import parsed client-side with `xlsx`/papaparse, inserted in chunks.
- Tax calculation in a shared pure helper with unit tests (20% total on 100 = 20.00).
- RLS: admin/stock_manager manage transfers, batches, taxes; cashiers read their branch only.
