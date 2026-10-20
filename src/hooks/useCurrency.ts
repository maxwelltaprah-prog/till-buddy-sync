import { useShopSettings } from '@/contexts/ShopSettingsContext';
import { useCallback } from 'react';

export function useCurrency() {
  const { settings } = useShopSettings();
  const symbol = settings.currency_symbol || 'GH₵';
  const code = settings.currency_code || 'GHS';

  const formatCurrency = useCallback((amount: number, decimals: number = 2): string => {
    return `${symbol}${amount.toFixed(decimals)}`;
  }, [symbol]);

  const formatPrice = useCallback((amount: number): string => {
    return formatCurrency(amount, 2);
  }, [formatCurrency]);

  return {
    symbol,
    code,
    formatCurrency,
    formatPrice,
  };
}
