import { describe, expect, it } from 'vitest';
import { canOpenScreen, screenEnabled } from './screenAccess';
describe('role screen controls', () => {
  it('disables a cashier screen when switched off', () => {
    expect(canOpenScreen(['cashier'], '/pos', [{role:'cashier', screen:'/pos', enabled:false}])).toBe(false);
  });
  it('activates a screen for the selected role only', () => {
    const overrides = [{role:'cashier' as const, screen:'/inventory', enabled:true}];
    expect(screenEnabled('cashier', '/inventory', overrides)).toBe(true);
    expect(screenEnabled('cashier', '/products', overrides)).toBe(false);
  });
  it('keeps user and store administration protected', () => {
    expect(canOpenScreen(['cashier'], '/users', [])).toBe(false);
    expect(canOpenScreen(['admin'], '/users', [])).toBe(true);
    expect(canOpenScreen(['admin'], '/stores', [])).toBe(false);
  });
  it('retains access to the profile when all screens are disabled', () => {
    expect(canOpenScreen(['cashier'], '/profile', [])).toBe(true);
  });
});