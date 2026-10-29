import { describe, expect, it } from 'vitest';
import { creditBranchScope } from './creditBranch';
describe('creditor branch access', () => {
  it('only administrators have all-branch scope', () => expect(creditBranchScope(true, 'branch-a')).toBeNull());
  it('limits cashiers and other staff to their assigned branch', () => expect(creditBranchScope(false, 'branch-a')).toBe('branch-a'));
  it('does not give unassigned staff all-branch access', () => expect(creditBranchScope(false)).toBe('00000000-0000-0000-0000-000000000000'));
});