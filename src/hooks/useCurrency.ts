import { useShopSettings } from '@/contexts/ShopSettingsContext';
import { useCallback } from 'react';

export function useCurrency() {
  const { settings } = useShopSettings();
  const symbol = settings.currency_symbol || 'GH₵';
  const code = settings.currency_code || 'GHS';

  const formatNumber = useCallback((amount: number, decimals: number = 2): string => {
    if (!Number.isFinite(amount)) amount = 0;
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }, []);

  const formatCurrency = useCallback((amount: number, decimals: number = 2): string => {
    return `${symbol}${formatNumber(amount, decimals)}`;
  }, [symbol, formatNumber]);

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
