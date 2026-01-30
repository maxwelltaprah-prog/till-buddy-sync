import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Product, CartItem } from '@/types/database';

// Database schema
interface POSDBSchema extends DBSchema {
  products: {
    key: string;
    value: Product;
    indexes: { 'by-sku': string; 'by-barcode': string };
  };
  pendingSales: {
    key: string;
    value: PendingSale;
    indexes: { 'by-status': string };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-type': string; 'by-created': number };
  };
  offlineCache: {
    key: string;
    value: CacheItem;
  };
}

export interface PendingSale {
  id: string;
  localId: string;
  branchId: string;
  cashierId: string;
  items: CartItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  cashReceived: number;
  changeGiven: number;
  status: 'pending' | 'synced' | 'failed';
  createdAt: number;
  syncedAt?: number;
  error?: string;
}

export interface SyncQueueItem {
  id: string;
  type: 'sale' | 'stock_movement' | 'return';
  data: unknown;
  status: 'pending' | 'processing' | 'synced' | 'failed';
  retries: number;
  createdAt: number;
  lastAttempt?: number;
  error?: string;
}

interface CacheItem {
  key: string;
  data: unknown;
  expiresAt: number;
}

const DB_NAME = 'superpos-offline';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<POSDBSchema> | null = null;

// Initialize database
export async function initOfflineDB(): Promise<IDBPDatabase<POSDBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<POSDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Products store
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', { keyPath: 'id' });
        productStore.createIndex('by-sku', 'sku');
        productStore.createIndex('by-barcode', 'barcode');
      }

      // Pending sales store
      if (!db.objectStoreNames.contains('pendingSales')) {
        const salesStore = db.createObjectStore('pendingSales', { keyPath: 'id' });
        salesStore.createIndex('by-status', 'status');
      }

      // Sync queue store
      if (!db.objectStoreNames.contains('syncQueue')) {
        const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        queueStore.createIndex('by-type', 'type');
        queueStore.createIndex('by-created', 'createdAt');
      }

      // Offline cache store
      if (!db.objectStoreNames.contains('offlineCache')) {
        db.createObjectStore('offlineCache', { keyPath: 'key' });
      }
    },
  });

  return dbInstance;
}

// Get database instance
export async function getDB(): Promise<IDBPDatabase<POSDBSchema>> {
  if (!dbInstance) {
    return initOfflineDB();
  }
  return dbInstance;
}

// ============= Product Operations =============

export async function cacheProducts(products: Product[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('products', 'readwrite');
  
  // Clear existing products and add new ones
  await tx.store.clear();
  for (const product of products) {
    await tx.store.put(product);
  }
  
  await tx.done;
}

export async function getCachedProducts(): Promise<Product[]> {
  const db = await getDB();
  return db.getAll('products');
}

export async function getProductBySku(sku: string): Promise<Product | undefined> {
  const db = await getDB();
  return db.getFromIndex('products', 'by-sku', sku);
}

export async function getProductByBarcode(barcode: string): Promise<Product | undefined> {
  const db = await getDB();
  return db.getFromIndex('products', 'by-barcode', barcode);
}

// ============= Pending Sales Operations =============

export async function savePendingSale(sale: PendingSale): Promise<void> {
  const db = await getDB();
  await db.put('pendingSales', sale);
}

export async function getPendingSales(): Promise<PendingSale[]> {
  const db = await getDB();
  return db.getAllFromIndex('pendingSales', 'by-status', 'pending');
}

export async function getAllPendingSales(): Promise<PendingSale[]> {
  const db = await getDB();
  return db.getAll('pendingSales');
}

export async function updateSaleStatus(
  id: string, 
  status: 'pending' | 'synced' | 'failed',
  error?: string
): Promise<void> {
  const db = await getDB();
  const sale = await db.get('pendingSales', id);
  if (sale) {
    sale.status = status;
    sale.syncedAt = status === 'synced' ? Date.now() : undefined;
    sale.error = error;
    await db.put('pendingSales', sale);
  }
}

export async function deleteSyncedSales(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('pendingSales', 'readwrite');
  const sales = await tx.store.getAll();
  
  for (const sale of sales) {
    if (sale.status === 'synced') {
      await tx.store.delete(sale.id);
    }
  }
  
  await tx.done;
}

// ============= Sync Queue Operations =============

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<string> {
  const db = await getDB();
  const id = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  await db.put('syncQueue', { ...item, id });
  return id;
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  const items = await db.getAllFromIndex('syncQueue', 'by-created');
  return items.filter(item => item.status === 'pending' || item.status === 'failed');
}

export async function updateSyncQueueItem(
  id: string,
  updates: Partial<SyncQueueItem>
): Promise<void> {
  const db = await getDB();
  const item = await db.get('syncQueue', id);
  if (item) {
    await db.put('syncQueue', { ...item, ...updates });
  }
}

export async function removeSyncedItems(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('syncQueue', 'readwrite');
  const items = await tx.store.getAll();
  
  for (const item of items) {
    if (item.status === 'synced') {
      await tx.store.delete(item.id);
    }
  }
  
  await tx.done;
}

// ============= Cache Operations =============

export async function setCache(key: string, data: unknown, ttlMinutes: number = 60): Promise<void> {
  const db = await getDB();
  await db.put('offlineCache', {
    key,
    data,
    expiresAt: Date.now() + ttlMinutes * 60 * 1000,
  });
}

export async function getCache<T>(key: string): Promise<T | null> {
  const db = await getDB();
  const item = await db.get('offlineCache', key);
  
  if (!item) return null;
  if (item.expiresAt < Date.now()) {
    await db.delete('offlineCache', key);
    return null;
  }
  
  return item.data as T;
}

export async function clearExpiredCache(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('offlineCache', 'readwrite');
  const items = await tx.store.getAll();
  const now = Date.now();
  
  for (const item of items) {
    if (item.expiresAt < now) {
      await tx.store.delete(item.key);
    }
  }
  
  await tx.done;
}

// ============= Utility Functions =============

export function generateLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function getOfflineStats(): Promise<{
  pendingSalesCount: number;
  syncQueueCount: number;
  cachedProductsCount: number;
}> {
  const db = await getDB();
  
  const [pendingSales, syncQueue, products] = await Promise.all([
    db.getAllFromIndex('pendingSales', 'by-status', 'pending'),
    getSyncQueue(),
    db.getAll('products'),
  ]);
  
  return {
    pendingSalesCount: pendingSales.length,
    syncQueueCount: syncQueue.length,
    cachedProductsCount: products.length,
  };
}
