import { useSyncExternalStore } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/** Admin-only header choice: view every branch combined. Never changes the assigned POS branch. */
const KEY = 'imax-all-branches';
const listeners = new Set<() => void>();
let current = typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1';

export function setAllBranchesView(value: boolean) {
  current = value;
  try { localStorage.setItem(KEY, value ? '1' : '0'); } catch { /* ignore */ }
  listeners.forEach(l => l());
}

export function useBranchScope() {
  const { branch, roles } = useAuth();
  const isAdmin = roles.includes('admin' as never);
  const stored = useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => current);
  const allBranches = isAdmin && stored;
  /** null = every branch (admin "All branches"); otherwise the assigned branch id. */
  const branchId = allBranches ? null : branch?.id ?? null;
  return { isAdmin, allBranches, branchId, branchName: allBranches ? 'All branches' : branch?.name ?? '' };
}
