import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Settings as SettingsIcon,
  Database,
  Download,
  Upload,
  Shield,
  Clock,
  Loader2,
  HardDrive,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

interface SystemSettings {
  auto_backup_enabled: boolean;
  backup_frequency: 'daily' | 'weekly' | 'monthly';
  backup_retention_days: number;
  last_backup_date: string | null;
}

export default function Settings() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [settings, setSettings] = useState<SystemSettings>({
    auto_backup_enabled: false,
    backup_frequency: 'daily',
    backup_retention_days: 30,
    last_backup_date: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportType, setExportType] = useState<'full' | 'sales' | 'inventory' | 'products'>('full');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'backup_settings')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings(data.value as unknown as SystemSettings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // Check if setting exists
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('key', 'backup_settings')
        .single();

      if (existing) {
        const { error } = await supabase
          .from('system_settings')
          .update({
            value: JSON.parse(JSON.stringify(settings)),
            description: 'Database backup configuration',
          })
          .eq('key', 'backup_settings');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('system_settings')
          .insert([{
            key: 'backup_settings',
            value: JSON.parse(JSON.stringify(settings)),
            description: 'Database backup configuration',
          }]);
        if (error) throw error;
      }
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const exportData = async () => {
    setIsExporting(true);
    try {
      let data: Record<string, unknown[]> = {};
      const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm');

      if (exportType === 'full' || exportType === 'products') {
        const { data: products } = await supabase.from('products').select('*');
        data.products = products || [];
        
        const { data: categories } = await supabase.from('categories').select('*');
        data.categories = categories || [];
        
        const { data: suppliers } = await supabase.from('suppliers').select('*');
        data.suppliers = suppliers || [];
        
        const { data: bulkTiers } = await supabase.from('bulk_pricing_tiers').select('*');
        data.bulk_pricing_tiers = bulkTiers || [];
      }

      if (exportType === 'full' || exportType === 'inventory') {
        const { data: inventory } = await supabase.from('branch_inventory').select('*');
        data.branch_inventory = inventory || [];
        
        const { data: movements } = await supabase.from('stock_movements').select('*').limit(10000);
        data.stock_movements = movements || [];
      }

      if (exportType === 'full' || exportType === 'sales') {
        const { data: sales } = await supabase.from('sales').select('*').limit(10000);
        data.sales = sales || [];
        
        const { data: saleItems } = await supabase.from('sale_items').select('*').limit(50000);
        data.sale_items = saleItems || [];
        
        const { data: returns } = await supabase.from('returns').select('*').limit(5000);
        data.returns = returns || [];
        
        const { data: returnItems } = await supabase.from('return_items').select('*').limit(10000);
        data.return_items = returnItems || [];
      }

      if (exportType === 'full') {
        const { data: branches } = await supabase.from('branches').select('*');
        data.branches = branches || [];
        
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, email, phone, branch_id, is_active, created_at');
        data.profiles = profiles || [];
        
        const { data: userRoles } = await supabase.from('user_roles').select('*');
        data.user_roles = userRoles || [];
      }

      // Create JSON file
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `superpos-backup-${exportType}-${timestamp}.json`;
      a.click();
      URL.revokeObjectURL(url);

      // Update last backup date
      const updatedSettings = {
        ...settings,
        last_backup_date: new Date().toISOString(),
      };
      setSettings(updatedSettings);
      
      // Check if setting exists
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('key', 'backup_settings')
        .single();

      if (existing) {
        await supabase
          .from('system_settings')
          .update({ value: JSON.parse(JSON.stringify(updatedSettings)) })
          .eq('key', 'backup_settings');
      } else {
        await supabase
          .from('system_settings')
          .insert([{
            key: 'backup_settings',
            value: JSON.parse(JSON.stringify(updatedSettings)),
          }]);
      }

      toast.success('Data exported successfully');
      setShowExportDialog(false);
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  // Export to CSV format
  const exportToCSV = async (tableName: 'products' | 'categories' | 'suppliers' | 'branch_inventory' | 'sales') => {
    try {
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error(`No data in ${tableName}`);
        return;
      }

      const headers = Object.keys(data[0]);
      const csvRows = [headers.join(',')];
      
      data.forEach(row => {
        const values = headers.map(header => {
          const val = row[header];
          if (val === null) return '';
          if (typeof val === 'object') return JSON.stringify(val).replace(/,/g, ';');
          return String(val).replace(/,/g, ';');
        });
        csvRows.push(values.join(','));
      });

      const csv = csvRows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tableName}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`${tableName} exported to CSV`);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV');
    }
  };

  if (!isAdmin) {
    return (
      <div>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Shield className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Access Denied</p>
          <p className="text-sm text-muted-foreground/70">
            Only administrators can access system settings
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Settings</h1>
        <p className="text-muted-foreground">
          Configure database backup and system preferences
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Backup Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Backup
              </CardTitle>
              <CardDescription>
                Configure automatic backup settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Automatic Backups</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable scheduled data exports
                  </p>
                </div>
                <Switch
                  checked={settings.auto_backup_enabled}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, auto_backup_enabled: checked })
                  }
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <div>
                  <Label>Backup Frequency</Label>
                  <Select
                    value={settings.backup_frequency}
                    onValueChange={(value: 'daily' | 'weekly' | 'monthly') =>
                      setSettings({ ...settings, backup_frequency: value })
                    }
                    disabled={!settings.auto_backup_enabled}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Retention Period (days)</Label>
                  <Input
                    type="number"
                    min="7"
                    max="365"
                    value={settings.backup_retention_days}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        backup_retention_days: parseInt(e.target.value) || 30,
                      })
                    }
                    disabled={!settings.auto_backup_enabled}
                    className="mt-1"
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Last backup:</span>
                  <span>
                    {settings.last_backup_date
                      ? format(new Date(settings.last_backup_date), 'MMM d, yyyy HH:mm')
                      : 'Never'}
                  </span>
                </div>
              </div>

              <Button onClick={saveSettings} disabled={isSaving} className="w-full">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Settings'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Export Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Data
              </CardTitle>
              <CardDescription>
                Download database exports in JSON or CSV format
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setExportType('full');
                    setShowExportDialog(true);
                  }}
                  className="h-auto py-4 flex-col gap-2"
                >
                  <HardDrive className="h-6 w-6" />
                  <span>Full Backup</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setExportType('sales');
                    setShowExportDialog(true);
                  }}
                  className="h-auto py-4 flex-col gap-2"
                >
                  <Download className="h-6 w-6" />
                  <span>Sales Data</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setExportType('inventory');
                    setShowExportDialog(true);
                  }}
                  className="h-auto py-4 flex-col gap-2"
                >
                  <Download className="h-6 w-6" />
                  <span>Inventory</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setExportType('products');
                    setShowExportDialog(true);
                  }}
                  className="h-auto py-4 flex-col gap-2"
                >
                  <Download className="h-6 w-6" />
                  <span>Products</span>
                </Button>
              </div>

              <Separator />

              <div>
                <Label className="mb-2 block">Quick CSV Export</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => exportToCSV('products')}
                  >
                    Products
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => exportToCSV('categories')}
                  >
                    Categories
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => exportToCSV('suppliers')}
                  >
                    Suppliers
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => exportToCSV('branch_inventory')}
                  >
                    Inventory
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => exportToCSV('sales')}
                  >
                    Sales
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium">Important</p>
                    <p className="text-muted-foreground">
                      Exports do not include user passwords. Store backups securely.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {/* Export confirmation dialog */}
      <AlertDialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export {exportType} Data</AlertDialogTitle>
            <AlertDialogDescription>
              This will download a JSON file containing your {exportType === 'full' ? 'complete database' : exportType} data.
              Large exports may take a moment to prepare.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={exportData} disabled={isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                'Export'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
