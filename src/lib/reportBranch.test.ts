import { describe, expect, it } from 'vitest';
import { resolveReportBranch } from './reportBranch';

describe('report branch scope', () => {
  it('allows an admin to switch to another branch', () => {
    expect(resolveReportBranch(true, 'branch-b', 'branch-a')).toBe('branch-b');
  });
  it('allows an admin to view all branches without an assigned branch', () => {
    expect(resolveReportBranch(true, 'all', null)).toBeNull();
  });
  it('keeps non-admins scoped to their assigned branch', () => {
    expect(resolveReportBranch(false, 'branch-b', 'branch-a')).toBe('branch-a');
    expect(resolveReportBranch(false, 'all', null)).toBeNull();
  });
});