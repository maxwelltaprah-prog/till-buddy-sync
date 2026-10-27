import { UNIT_VALUES } from '@/lib/units';
import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PaginationBar, usePagination } from '@/components/PaginationBar';
import { toast } from 'sonner';
import { Download, Loader2, Upload } from 'lucide-react';

const COLUMNS = ['sku', 'name', 'barcode', 'category', 'supplier', 'unit', 'retail_price', 'cost_price', 'tax_rate', 'min_stock_level', 'shelf_life_days', 'opening_stock', 'batch_number', 'mfg_date', 'expiry_date', 'description'];
const UNITS = UNIT_VALUES;

interface ParsedRow { raw: Record<string, any>; errors: string[]; }

const toDate = (v: any): string | null => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : null;
  }
  const s = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

export default function BulkImport() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState('');
  const [busy, setBusy] = useState(false);
  const pg = usePagination(rows);

  useEffect(() => {
    supabase.from('branches').select('id, name').eq('is_active', true).order('name').then(({ data }) => {
      setBranches(data || []);
      if (data?.[0]) setBranchId(data[0].id);
    });
  }, []);

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([COLUMNS, ['SKU001', 'Sample Rice 5kg', '6001234567890', 'Groceries', '', 'pcs', 120, 95, 0, 10, 365, 50, 'B001', '2026-01-01', '2027-01-01', '']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'product_import_template.xlsx');
  };

  const onFile = async (file: File) => {
    const wb = XLSX.read(await file.arrayBuffer());
    const data = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    const seen = new Set<string>();
    setRows(data.map((r) => {
      const raw: Record<string, any> = {};
      Object.entries(r).forEach(([k, v]) => (raw[k.trim().toLowerCase()] = typeof v === 'string' ? v.trim() : v));
      const errors: string[] = [];
      if (!raw.sku) errors.push('SKU required');
      if (!raw.name) errors.push('Name required');
      if (raw.retail_price === '' || isNaN(Number(raw.retail_price))) errors.push('Invalid retail price');
      if (raw.unit && !UNITS.includes(String(raw.unit).toLowerCase())) errors.push('Invalid unit');
      if (raw.mfg_date && !toDate(raw.mfg_date)) errors.push('Mfg date must be YYYY-MM-DD');
      if (raw.expiry_date && !toDate(raw.expiry_date)) errors.push('Expiry date must be YYYY-MM-DD');
      if (raw.sku && seen.has(String(raw.sku))) errors.push('Duplicate SKU in file');
      seen.add(String(raw.sku));
      return { raw, errors };
    }));
  };

  const valid = rows.filter((r) => r.errors.length === 0);

  const runImport = async () => {
    if (!valid.length) return;
    setBusy(true);
    try {
      const [{ data: cats }, { data: sups }] = await Promise.all([
        supabase.from('categories').select('id, name'),
        supabase.from('suppliers').select('id, name'),
      ]);
      const catMap = new Map((cats || []).map((c) => [c.name.toLowerCase(), c.id]));
      const supMap = new Map((sups || []).map((s) => [s.name.toLowerCase(), s.id]));
      const newCats = Array.from(new Set(valid.map((r) => String(r.raw.category || '')).filter((c) => c && !catMap.has(c.toLowerCase()))
        .map((c) => c.toLowerCase()))).map((lc) => valid.find((r) => String(r.raw.category).toLowerCase() === lc)!.raw.category as string);
      if (newCats.length) {
        const { data, error } = await supabase.from('categories').insert(newCats.map((name) => ({ name: String(name) }))).select('id, name');
        if (error) throw error;
        data?.forEach((c) => catMap.set(c.name.toLowerCase(), c.id));
      }
      const payload = valid.map(({ raw }) => ({
        sku: String(raw.sku), name: String(raw.name), barcode: raw.barcode ? String(raw.barcode) : null,
        category_id: raw.category ? catMap.get(String(raw.category).toLowerCase()) || null : null,
        supplier_id: raw.supplier ? supMap.get(String(raw.supplier).toLowerCase()) || null : null,
        unit: (raw.unit ? String(raw.unit).toLowerCase() : 'pcs') as any,
        retail_price: Number(raw.retail_price), cost_price: Number(raw.cost_price) || 0, tax_rate: Number(raw.tax_rate) || 0,
        min_stock_level: Number(raw.min_stock_level) || 0, shelf_life_days: raw.shelf_life_days ? Number(raw.shelf_life_days) : null,
        description: raw.description || null, is_active: true,
      }));
      const ids = new Map<string, string>();
      for (let i = 0; i < payload.length; i += 200) {
        const { data, error } = await supabase.from('products').upsert(payload.slice(i, i + 200), { onConflict: 'store_id,sku' }).select('id, sku');
        if (error) throw error;
        data?.forEach((d) => ids.set(d.sku, d.id));
      }
      if (branchId) {
        const stockRows = valid.map(({ raw }) => ({ raw, qty: Number(raw.opening_stock), pid: ids.get(String(raw.sku)) }))
          .filter((r) => r.qty > 0 && r.pid) as { raw: Record<string, any>; qty: number; pid: string }[];
        const invMap = new Map<string, { id: string; quantity: number }>();
        for (let i = 0; i < stockRows.length; i += 200) {
          const { data, error } = await supabase.from('branch_inventory').select('id, product_id, quantity')
            .eq('branch_id', branchId).in('product_id', stockRows.slice(i, i + 200).map((r) => r.pid));
          if (error) throw error;
          data?.forEach((d) => invMap.set(d.product_id, { id: d.id, quantity: Number(d.quantity) }));
        }
        const missing = stockRows.filter((r) => !invMap.has(r.pid));
        for (let i = 0; i < missing.length; i += 200) {
          const { error } = await supabase.from('branch_inventory').insert(missing.slice(i, i + 200).map((r) => ({ branch_id: branchId, product_id: r.pid, quantity: r.qty })));
          if (error) throw error;
        }
        const existing = stockRows.filter((r) => invMap.has(r.pid));
        for (let i = 0; i < existing.length; i += 20) {
          const results = await Promise.all(existing.slice(i, i + 20).map((r) => {
            const inv = invMap.get(r.pid)!;
            return supabase.from('branch_inventory').update({ quantity: inv.quantity + r.qty }).eq('id', inv.id);
          }));
          const err = results.find((x) => x.error)?.error; if (err) throw err;
        }
        const movements = stockRows.map((r) => ({ branch_id: branchId, product_id: r.pid, operation_type: 'receive' as const, quantity: r.qty, reason: 'Bulk import opening stock', performed_by: user?.id }));
        const batches = stockRows.filter(({ raw }) => raw.mfg_date || raw.expiry_date || raw.batch_number)
          .map(({ raw, qty, pid }) => ({ branch_id: branchId, product_id: pid, quantity: qty, batch_number: raw.batch_number ? String(raw.batch_number) : null, mfg_date: toDate(raw.mfg_date), expiry_date: toDate(raw.expiry_date), created_by: user?.id }));
        for (let i = 0; i < movements.length; i += 200) {
          const { error } = await supabase.from('stock_movements').insert(movements.slice(i, i + 200)); if (error) throw error;
        }
        for (let i = 0; i < batches.length; i += 200) {
          const { error } = await supabase.from('product_batches').insert(batches.slice(i, i + 200)); if (error) throw error;
        }
      }
      toast.success(`Imported ${valid.length} products`);
      setRows([]);
    } catch (e: any) {
      toast.error(e.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bulk Product Import</h1>
        <p className="text-muted-foreground">Upload a CSV or Excel file. Existing products are updated by SKU.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Upload File</CardTitle>
          <CardDescription>Columns: {COLUMNS.join(', ')}. Dates as YYYY-MM-DD.<br />Allowed units: {UNITS.join(', ')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Button variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2" />Template</Button>
          <div className="space-y-1">
            <Label>File</Label>
            <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </div>
          <div className="space-y-1">
            <Label>Opening stock location</Label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={runImport} disabled={busy || !valid.length}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Import {valid.length} valid rows
          </Button>
        </CardContent>
      </Card>
      {rows.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Preview ({rows.length} rows, {rows.length - valid.length} with errors)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Price</TableHead><TableHead>Stock</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {pg.pageItems.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{r.raw.sku}</TableCell><TableCell>{r.raw.name}</TableCell><TableCell>{r.raw.category}</TableCell>
                    <TableCell>{r.raw.retail_price}</TableCell><TableCell>{r.raw.opening_stock}</TableCell><TableCell>{toDate(r.raw.expiry_date) || ''}</TableCell>
                    <TableCell>{r.errors.length ? <Badge variant="destructive">{r.errors.join('; ')}</Badge> : <Badge className="bg-success/15 text-success">OK</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar {...pg} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
