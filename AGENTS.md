# Agent Rules
- Receipt print documents declare UTF-8 and escape saved text before HTML insertion; wait for logos before printing so branding and cedi symbols render correctly.
- Tax is computed only via `src/lib/tax.ts` from `tax_components` rows — keeps POS, receipts and reports consistent.
- Stock transfers go through the `transfer_stock` DB function — keeps both sides and movement logs atomic.
- Lists use `usePagination` + `PaginationBar` from `src/components/PaginationBar.tsx` — one consistent pager.
- Sales and profit reports use `useReportBranch` for local report scope, never changing the user's assigned POS branch; database policies remain the access authority.
