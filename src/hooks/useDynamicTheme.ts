import { useEffect } from 'react';
import { useShopSettings } from '@/contexts/ShopSettingsContext';

// Convert hex color to HSL
function hexToHSL(hex: string): { h: number; s: number; l: number } | null {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Parse hex values
  if (hex.length !== 6) return null;

  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// Generate color variations
function generateColorVariations(hsl: { h: number; s: number; l: number }) {
  return {
    // Main primary color
    primary: `${hsl.h} ${hsl.s}% ${hsl.l}%`,
    // Glow/lighter version
    primaryGlow: `${hsl.h} ${Math.min(hsl.s + 5, 100)}% ${Math.min(hsl.l + 10, 70)}%`,
    // Ring color (same as primary)
    ring: `${hsl.h} ${hsl.s}% ${hsl.l}%`,
    // Sidebar primary
    sidebarPrimary: `${hsl.h} ${hsl.s}% ${Math.min(hsl.l + 10, 70)}%`,
  };
}

export function useDynamicTheme() {
  const { settings, isLoading } = useShopSettings();

  useEffect(() => {
    if (isLoading) return;

    const primaryColor = settings.primary_color;
    if (!primaryColor) return;

    const hsl = hexToHSL(primaryColor);
    if (!hsl) return;

    const variations = generateColorVariations(hsl);

    // Apply to CSS custom properties
    const root = document.documentElement;
    
    // Light mode colors
    root.style.setProperty('--primary', variations.primary);
    root.style.setProperty('--primary-glow', variations.primaryGlow);
    root.style.setProperty('--ring', variations.ring);
    root.style.setProperty('--sidebar-primary', variations.sidebarPrimary);
    root.style.setProperty('--sidebar-ring', variations.sidebarPrimary);

    // Also update some related colors for consistency
    root.style.setProperty('--border', `${hsl.h} 30% 90%`);
    root.style.setProperty('--input', `${hsl.h} 30% 90%`);
    
    // Secondary with matching hue
    root.style.setProperty('--secondary', `${hsl.h} 50% 96%`);
    root.style.setProperty('--secondary-foreground', `${hsl.h} 50% 30%`);

    // Cleanup function to reset to defaults if needed
    return () => {
      // Optionally reset colors when component unmounts
    };
  }, [settings.primary_color, isLoading]);
}
