import type { AppRole } from '@/types/database';

export const SCREENS = [
  { path: '/pos', label: 'POS Terminal', roles: ['cashier'] },
  { path: '/dashboard', label: 'Dashboard', roles: ['branch_supervisor'] },
  { path: '/products', label: 'Products', roles: ['stock_manager'] },
  { path: '/categories', label: 'Categories', roles: [] },
  { path: '/inventory', label: 'Inventory', roles: ['stock_manager', 'branch_supervisor'] },
  { path: '/stock-movements', label: 'Stock Movements', roles: ['stock_manager'] },
  { path: '/stock-transfers', label: 'Stock Transfers', roles: ['stock_manager'] },
  { path: '/expiry', label: 'Expiry Ageing', roles: ['stock_manager', 'branch_supervisor'] },
  { path: '/bulk-import', label: 'Bulk Import', roles: ['stock_manager'] },
  { path: '/suppliers', label: 'Suppliers', roles: ['stock_manager'] },
  { path: '/returns', label: 'Returns', roles: ['cashier', 'branch_supervisor'] },
  { path: '/creditors', label: 'Creditors', roles: ['cashier', 'branch_supervisor'] },
  { path: '/reports', label: 'Sales Reports', roles: ['branch_supervisor'] },
  { path: '/profit', label: 'Profit Report', roles: ['branch_supervisor'] },
];
export const STAFF_ROLES: AppRole[] = ['cashier', 'stock_manager', 'branch_supervisor'];
export interface ScreenOverride { role: AppRole; screen: string; enabled: boolean }
export function screenEnabled(role: AppRole, path: string, overrides: ScreenOverride[]) {
  if (role === 'admin') return true;
  const screen = SCREENS.find(s => s.path === path);
  if (!screen) return false;
  return overrides.find(o => o.role === role && o.screen === path)?.enabled ?? screen.roles.includes(role);
}
export function canOpenScreen(roles: AppRole[], path: string, overrides: ScreenOverride[], owner = false) {
  const normalized = path === '/' ? '/dashboard' : path;
  if (normalized === '/stores') return owner;
  if (normalized === '/profile') return true;
  return roles.some(role => screenEnabled(role, normalized, overrides));
}