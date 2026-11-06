import { describe, it, expect } from 'vitest';
import { roleChangeError } from '../../supabase/functions/manage-users/accountRules';

const base = { admin: true, owner: false, callerId: 'a', callerStore: 's1', targetId: 'b', targetStore: 's1', targetOwner: false, activeStore: true, role: 'cashier' };

describe('roleChangeError', () => {
  it('lets a store admin change an employee role in their store', () => expect(roleChangeError(base)).toBeNull());
  it('blocks admins from changing their own role', () => expect(roleChangeError({ ...base, targetId: 'a' })).toMatch(/own role/));
  it('blocks non-admins', () => expect(roleChangeError({ ...base, admin: false })).not.toBeNull());
  it('blocks other stores', () => expect(roleChangeError({ ...base, targetStore: 's2' })).not.toBeNull());
  it('blocks inactive stores', () => expect(roleChangeError({ ...base, activeStore: false })).not.toBeNull());
  it('protects the platform owner account', () => expect(roleChangeError({ ...base, targetOwner: true })).not.toBeNull());
  it('rejects unknown roles', () => expect(roleChangeError({ ...base, role: 'superuser' })).not.toBeNull());
});
