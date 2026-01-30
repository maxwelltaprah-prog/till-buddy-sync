import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Store,
  Loader2,
  Upload,
  Shield,
  Palette,
  Save,
  ImageIcon,
} from 'lucide-react';

interface ShopSettings {
  shop_name: string;
  tagline: string;
  logo_url: string;
  receipt_header: string;
  receipt_footer: string;
  currency_symbol: string;
  primary_color: string;
}

const defaultSettings: ShopSettings = {
  shop_name: 'SuperPOS',
  tagline: 'Enterprise Point of Sale',
  logo_url: '',
  receipt_header: 'Thank you for shopping with us!',
  receipt_footer: 'Visit us again soon!',
  currency_symbol: '$',
  primary_color: '#7c3aed',
};

export default function ShopSettings() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<ShopSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [previewLogo, setPreviewLogo] = useState<string>('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'shop_settings')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const loadedSettings = data.value as unknown as ShopSettings;
        setSettings({ ...defaultSettings, ...loadedSettings });
        if (loadedSettings.logo_url) {
          setPreviewLogo(loadedSettings.logo_url);
        }
      }
    } catch (error) {
      console.error('Error fetching shop settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('key', 'shop_settings')
        .single();

      const settingsToSave = { ...settings, logo_url: previewLogo || settings.logo_url };

      if (existing) {
        const { error } = await supabase
          .from('system_settings')
          .update({
            value: JSON.parse(JSON.stringify(settingsToSave)),
            description: 'Shop branding and customization settings',
          })
          .eq('key', 'shop_settings');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('system_settings')
          .insert([{
            key: 'shop_settings',
            value: JSON.parse(JSON.stringify(settingsToSave)),
            description: 'Shop branding and customization settings',
          }]);
        if (error) throw error;
      }
      
      setSettings(settingsToSave);
      toast.success('Shop settings saved successfully');
    } catch (error) {
      console.error('Error saving shop settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be less than 2MB');
      return;
    }

    // Convert to base64 for preview (for actual deployment, use storage)
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPreviewLogo(base64);
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setPreviewLogo('');
    setSettings({ ...settings, logo_url: '' });
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Shield className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Access Denied</p>
          <p className="text-sm text-muted-foreground/70">
            Only administrators can access shop settings
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Store className="h-6 w-6" />
          Shop Settings
        </h1>
        <p className="text-muted-foreground">
          Customize your store branding and appearance
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Info */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Store Information
              </CardTitle>
              <CardDescription>
                Set your store name and branding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shop_name">Shop Name</Label>
                <Input
                  id="shop_name"
                  value={settings.shop_name}
                  onChange={(e) => setSettings({ ...settings, shop_name: e.target.value })}
                  placeholder="Your Store Name"
                  className="text-lg font-semibold"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  value={settings.tagline}
                  onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                  placeholder="Your store's tagline"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency Symbol</Label>
                <Input
                  id="currency"
                  value={settings.currency_symbol}
                  onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
                  placeholder="$"
                  maxLength={5}
                  className="w-24"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Store Logo</Label>
                <div className="flex items-center gap-4">
                  {previewLogo ? (
                    <div className="relative">
                      <img
                        src={previewLogo}
                        alt="Store logo"
                        className="w-20 h-20 object-contain rounded-lg border bg-background"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                        onClick={removeLogo}
                      >
                        ×
                      </Button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Logo
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG, JPG up to 2MB
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Receipt Settings */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Receipt Customization
              </CardTitle>
              <CardDescription>
                Customize your printed receipts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="receipt_header">Receipt Header Message</Label>
                <Textarea
                  id="receipt_header"
                  value={settings.receipt_header}
                  onChange={(e) => setSettings({ ...settings, receipt_header: e.target.value })}
                  placeholder="Thank you for shopping with us!"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="receipt_footer">Receipt Footer Message</Label>
                <Textarea
                  id="receipt_footer"
                  value={settings.receipt_footer}
                  onChange={(e) => setSettings({ ...settings, receipt_footer: e.target.value })}
                  placeholder="Visit us again soon!"
                  rows={2}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="primary_color">Brand Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="primary_color"
                    value={settings.primary_color}
                    onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                    className="w-12 h-12 rounded-lg border cursor-pointer"
                  />
                  <Input
                    value={settings.primary_color}
                    onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                    placeholder="#7c3aed"
                    className="w-32"
                  />
                  <div
                    className="px-4 py-2 rounded-lg text-white font-medium"
                    style={{ backgroundColor: settings.primary_color }}
                  >
                    Preview
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview Card */}
          <Card className="md:col-span-2 glass">
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                See how your branding will appear
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6 p-6 rounded-xl bg-gradient-to-r from-sidebar to-sidebar/80">
                {previewLogo ? (
                  <img
                    src={previewLogo}
                    alt="Store logo"
                    className="w-16 h-16 object-contain rounded-lg"
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: settings.primary_color }}
                  >
                    <Store className="h-8 w-8 text-white" />
                  </div>
                )}
                <div>
                  <h2 className="text-2xl font-bold text-sidebar-foreground">
                    {settings.shop_name || 'Your Store Name'}
                  </h2>
                  <p className="text-sidebar-foreground/70">
                    {settings.tagline || 'Your tagline here'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={saveSettings} disabled={isSaving} size="lg">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Shop Settings
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
