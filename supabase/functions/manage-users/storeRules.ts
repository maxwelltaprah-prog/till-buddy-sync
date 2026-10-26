export function storeActionError({ owner, action, currentStoreId, targetStoreId, archived, active }: {
  owner: boolean; action: string; currentStoreId: string | null; targetStoreId: string;
  archived: boolean; active?: boolean;
}): string | null {
  if (!owner) return 'Only the platform owner can manage stores';
  if (archived) return 'This store has been archived';
  if ((action === 'archive_store' || (action === 'set_store_status' && active === false)) && currentStoreId === targetStoreId) {
    return 'Enter another store before deactivating or archiving your current store';
  }
  return null;
}