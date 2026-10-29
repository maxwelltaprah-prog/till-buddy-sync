/** Null means all branches (admin); missing branch fails closed for staff. */
export function creditBranchScope(admin: boolean, branchId?: string | null): string | null {
  return admin ? null : branchId || '00000000-0000-0000-0000-000000000000';
}