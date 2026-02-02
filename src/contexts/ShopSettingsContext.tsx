import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ShopSettings {
  shop_name: string;
  tagline: string;
  logo_url: string;
  receipt_header: string;
  receipt_footer: string;
  currency_symbol: string;
  primary_color: string;
  phone: string;
  email: string;
  address: string;
}

const defaultSettings: ShopSettings = {
  shop_name: 'iMaxSuperPOS',
  tagline: 'Enterprise Point of Sale',
  logo_url: '',
  receipt_header: 'Thank you for shopping with us!',
  receipt_footer: 'Visit us again soon!',
  currency_symbol: '$',
  primary_color: '#7c3aed',
  phone: '',
  email: '',
  address: '',
};

interface ShopSettingsContextType {
  settings: ShopSettings;
  isLoading: boolean;
  refreshSettings: () => Promise<void>;
}

const ShopSettingsContext = createContext<ShopSettingsContextType | undefined>(undefined);

export function ShopSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ShopSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'shop_settings')
        .maybeSingle();

      if (error) {
        console.error('Error fetching shop settings:', error);
        return;
      }

      if (data?.value) {
        const loadedSettings = data.value as unknown as ShopSettings;
        setSettings({ ...defaultSettings, ...loadedSettings });
      }
    } catch (error) {
      console.error('Error fetching shop settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();

    // Subscribe to changes
    const channel = supabase
      .channel('shop_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: 'key=eq.shop_settings',
        },
        () => {
          fetchSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const refreshSettings = async () => {
    await fetchSettings();
  };

  return (
    <ShopSettingsContext.Provider value={{ settings, isLoading, refreshSettings }}>
      {children}
    </ShopSettingsContext.Provider>
  );
}

export function useShopSettings() {
  const context = useContext(ShopSettingsContext);
  // Return default settings if used outside provider (prevents crashes during hydration)
  if (context === undefined) {
    return {
      settings: defaultSettings,
      isLoading: false,
      refreshSettings: async () => {},
    };
  }
  return context;
}
