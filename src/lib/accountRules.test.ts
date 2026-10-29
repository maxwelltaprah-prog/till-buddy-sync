import { describe, expect, it } from 'vitest';
import { accountUpdateError } from '../../supabase/functions/manage-users/accountRules';
const base = {admin:true, owner:false, callerStore:'a', targetStore:'a', targetOwner:false, activeStore:true, email:'staff@example.com', password:undefined};
describe('admin account editing', () => {
  it('allows email-only editing within the same store', () => expect(accountUpdateError(base)).toBeNull());
  it('rejects another store', () => expect(accountUpdateError({...base,targetStore:'b'})).toBe('Only administrators can update users in their active store'));
  it('rejects non-administrators', () => expect(accountUpdateError({...base,admin:false})).toBe('Only administrators can update users in their active store'));
  it('protects platform owner accounts', () => expect(accountUpdateError({...base,targetOwner:true})).toBe('Only the platform owner can update this account'));
  it('rejects passwords shorter than six characters', () => expect(accountUpdateError({...base,password:'12345'})).toBe('Password must be between 6 and 128 characters'));
});