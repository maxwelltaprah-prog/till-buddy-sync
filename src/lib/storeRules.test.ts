import { describe, expect, it } from 'vitest';
import { storeActionError } from '../../supabase/functions/manage-users/storeRules';

const base = { owner: true, currentStoreId: 'current', targetStoreId: 'other', archived: false };
describe('store lifecycle permissions', () => {
  it('only permits platform owners to manage stores', () => {
    for (const action of ['reset_store_password', 'set_store_status', 'archive_store']) {
      expect(storeActionError({ ...base, owner: false, action })).toBe('Only the platform owner can manage stores');
    }
  });
  it('blocks changes to archived stores', () => {
    expect(storeActionError({ ...base, archived: true, action: 'set_store_status', active: true })).toBe('This store has been archived');
  });
  it('prevents archiving the current store', () => {
    expect(storeActionError({ ...base, targetStoreId: 'current', action: 'archive_store' })).toBe('Enter another store before deactivating or archiving your current store');
  });
  it('permits activation and deactivation of other stores', () => {
    expect(storeActionError({ ...base, action: 'set_store_status', active: true })).toBeNull();
    expect(storeActionError({ ...base, action: 'set_store_status', active: false })).toBeNull();
  });
});