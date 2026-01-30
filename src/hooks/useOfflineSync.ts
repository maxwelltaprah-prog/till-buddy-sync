import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  initOfflineDB,
  cacheProducts,
  getCachedProducts,
  getPendingSales,
  updateSaleStatus,
  getSyncQueue,
  updateSyncQueueItem,
  removeSyncedItems,
  deleteSyncedSales,
  getOfflineStats,
  type PendingSale,
} from '@/lib/offlineDb';
import type { Product } from '@/types/database';
import { toast } from 'sonner';

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: Date | null;
  error: string | null;
}

export function useOfflineSync(branchId?: string) {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    lastSyncAt: null,
    error: null,
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize offline database
  useEffect(() => {
    const init = async () => {
      try {
        await initOfflineDB();
        await updatePendingCount();
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize offline DB:', error);
      }
    };
    init();
  }, []);

  // Online/offline event listeners
  useEffect(() => {
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
      toast.success('Back online! Syncing data...');
      syncPendingData();
    };

    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false }));
      toast.warning('You are offline. Data will be saved locally.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Periodic sync check
  useEffect(() => {
    if (status.isOnline && isInitialized) {
      syncIntervalRef.current = setInterval(() => {
        syncPendingData();
      }, 30000); // Sync every 30 seconds

      // Initial sync
      syncPendingData();
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [status.isOnline, isInitialized]);

  const updatePendingCount = async () => {
    const stats = await getOfflineStats();
    setStatus(prev => ({
      ...prev,
      pendingCount: stats.pendingSalesCount + stats.syncQueueCount,
    }));
  };

  // Cache products for offline use
  const cacheProductsForOffline = useCallback(async (products: Product[]) => {
    try {
      await cacheProducts(products);
    } catch (error) {
      console.error('Failed to cache products:', error);
    }
  }, []);

  // Get products (from cache if offline)
  const getProducts = useCallback(async (): Promise<Product[]> => {
    if (status.isOnline && branchId) {
      try {
        const { data, error } = await supabase
          .from('products')
          .select(`
            *,
            category:categories(*),
            bulk_pricing_tiers(*),
            branch_inventory!inner(quantity)
          `)
          .eq('is_active', true)
          .eq('branch_inventory.branch_id', branchId);

        if (error) throw error;
        
        // Cache products for offline use
        if (data) {
          await cacheProducts(data as Product[]);
        }
        
        return data as Product[] || [];
      } catch (error) {
        console.error('Failed to fetch products:', error);
        // Fall back to cached products
        return getCachedProducts();
      }
    } else {
      return getCachedProducts();
    }
  }, [status.isOnline, branchId]);

  // Sync pending sales
  const syncPendingSales = async () => {
    const pendingSales = await getPendingSales();
    
    for (const sale of pendingSales) {
      try {
        await syncSale(sale);
        await updateSaleStatus(sale.id, 'synced');
      } catch (error) {
        console.error('Failed to sync sale:', sale.id, error);
        await updateSaleStatus(sale.id, 'failed', String(error));
      }
    }
    
    // Clean up synced sales
    await deleteSyncedSales();
  };

  // Sync a single sale to the server
  const syncSale = async (sale: PendingSale) => {
    // Generate receipt number
    const { data: branchData } = await supabase
      .from('branches')
      .select('code')
      .eq('id', sale.branchId)
      .single();

    if (!branchData) throw new Error('Branch not found');

    const { data: receiptNumber, error: receiptError } = await supabase.rpc(
      'generate_receipt_number',
      { branch_code: branchData.code }
    );

    if (receiptError) throw receiptError;

    // Create sale record
    const { data: saleRecord, error: saleError } = await supabase
      .from('sales')
      .insert({
        receipt_number: receiptNumber,
        branch_id: sale.branchId,
        cashier_id: sale.cashierId,
        subtotal: sale.subtotal,
        tax_amount: sale.taxAmount,
        total: sale.total,
        cash_received: sale.cashReceived,
        change_given: sale.changeGiven,
        status: 'completed',
        local_id: sale.localId,
        is_synced: true,
      })
      .select()
      .single();

    if (saleError) throw saleError;

    // Create sale items
    const saleItems = sale.items.map((item) => ({
      sale_id: saleRecord.id,
      product_id: item.product.id,
      product_name: item.product.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      is_bulk_price: item.is_bulk_price,
      discount_amount: item.discount_amount,
      tax_amount: item.total * (item.product.tax_rate / 100),
      total: item.total,
    }));

    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItems);

    if (itemsError) throw itemsError;

    // Update inventory
    for (const item of sale.items) {
      const { data: currentInventory } = await supabase
        .from('branch_inventory')
        .select('quantity')
        .eq('branch_id', sale.branchId)
        .eq('product_id', item.product.id)
        .single();

      if (currentInventory) {
        await supabase
          .from('branch_inventory')
          .update({ quantity: currentInventory.quantity - item.quantity })
          .eq('branch_id', sale.branchId)
          .eq('product_id', item.product.id);
      }

      // Record stock movement
      await supabase.from('stock_movements').insert({
        branch_id: sale.branchId,
        product_id: item.product.id,
        operation_type: 'sale',
        quantity: -item.quantity,
        reference_id: saleRecord.id,
        reference_type: 'sale',
        performed_by: sale.cashierId,
      });
    }
  };

  // Sync queue items
  const syncQueueItems = async () => {
    const queue = await getSyncQueue();
    
    for (const item of queue) {
      if (item.retries >= 5) continue; // Skip items with too many retries

      try {
        await updateSyncQueueItem(item.id, { 
          status: 'processing',
          lastAttempt: Date.now(),
        });

        // Process based on type
        switch (item.type) {
          case 'stock_movement':
            await supabase.from('stock_movements').insert(item.data as any);
            break;
          // Add other types as needed
        }

        await updateSyncQueueItem(item.id, { status: 'synced' });
      } catch (error) {
        await updateSyncQueueItem(item.id, {
          status: 'failed',
          retries: item.retries + 1,
          error: String(error),
        });
      }
    }

    await removeSyncedItems();
  };

  // Main sync function
  const syncPendingData = useCallback(async () => {
    if (!status.isOnline || status.isSyncing) return;

    setStatus(prev => ({ ...prev, isSyncing: true, error: null }));

    try {
      await syncPendingSales();
      await syncQueueItems();
      await updatePendingCount();
      
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: new Date(),
      }));
    } catch (error) {
      console.error('Sync error:', error);
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        error: String(error),
      }));
    }
  }, [status.isOnline, status.isSyncing]);

  // Manual sync trigger
  const triggerSync = useCallback(async () => {
    if (!status.isOnline) {
      toast.error('Cannot sync while offline');
      return;
    }
    await syncPendingData();
    toast.success('Sync completed');
  }, [status.isOnline, syncPendingData]);

  return {
    ...status,
    isInitialized,
    cacheProductsForOffline,
    getProducts,
    syncPendingData,
    triggerSync,
    updatePendingCount,
  };
}
