export const ALL_REPORT_BRANCHES = 'all';

// This is query scoping only; database policies enforce access.
export function resolveReportBranch(isAdmin: boolean, selected: string, assigned: string | null): string | null {
  return isAdmin ? (selected === ALL_REPORT_BRANCHES ? null : selected) : assigned;
}