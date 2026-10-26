# Agent Rules
- Receipt print documents declare UTF-8 and escape saved text before HTML insertion; wait for logos before printing so branding and cedi symbols render correctly.
- Tax is computed only via `src/lib/tax.ts` from `tax_components` rows — keeps POS, receipts and reports consistent.
- Stock transfers go through the `transfer_stock` DB function — keeps both sides and movement logs atomic.
- Store isolation: tenant tables carry `store_id` (default `current_store_id()`) guarded by RESTRICTIVE RLS; users are created only via the `manage-users` function — keeps stores separate and roles server-assigned.
- Credit ageing status comes only from `src/lib/credit.ts`; repayments go through `credit_payments` (trigger updates the balance) — keeps POS alerts, notifications and the Creditors page consistent.
- Lists use `usePagination` + `PaginationBar` from `src/components/PaginationBar.tsx` — one consistent pager.
- Sales and profit reports use `useReportBranch` for local report scope, never changing the user's assigned POS branch; database policies remain the access authority.
