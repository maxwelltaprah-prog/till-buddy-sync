# Agent Rules
- Tax is computed only via `src/lib/tax.ts` from `tax_components` rows — keeps POS, receipts and reports consistent.
- Stock transfers go through the `transfer_stock` DB function — keeps both sides and movement logs atomic.
- Lists use `usePagination` + `PaginationBar` from `src/components/PaginationBar.tsx` — one consistent pager.
