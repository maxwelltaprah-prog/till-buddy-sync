import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Save, Trash2 } from 'lucide-react';

interface Row { id?: string; name: string; code: string; rate: number; description: string | null; is_active: boolean; sort_order: number; }

export default function TaxSettings() {
  const [rows, setRows] = useState<Row[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);

  const load = async () => {
    const { data } = await supabase.from('tax_components').select('*').order('sort_order');
    setRows((data as Row[]) || []);
    setRemoved([]);
  };
  useEffect(() => { load(); }, []);

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const save = async () => {
    try {
      if (removed.length) {
        const { error } = await supabase.from('tax_components').delete().in('id', removed);
        if (error) throw error;
      }
      for (const [i, r] of rows.entries()) {
        if (!r.name || !r.code) throw new Error('Each tax needs a name and code');
        const payload = { name: r.name, code: r.code, rate: Number(r.rate) || 0, description: r.description, is_active: r.is_active, sort_order: i + 1 };
        const { error } = r.id
          ? await supabase.from('tax_components').update(payload).eq('id', r.id)
          : await supabase.from('tax_components').insert(payload);
        if (error) throw error;
      }
      toast.success('Tax settings saved');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    }
  };

  const total = rows.filter((r) => r.is_active).reduce((s, r) => s + Number(r.rate || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tax Settings</h1>
        <p className="text-muted-foreground">Ghana decoupled method: each tax is calculated on the taxable subtotal and summed.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tax Components</CardTitle>
          <CardDescription>Total effective tax rate: <strong>{total.toFixed(1)}%</strong></CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Rate %</TableHead>
                <TableHead>Description</TableHead><TableHead>Active</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.id || i}>
                  <TableCell><Input value={r.name} onChange={(e) => update(i, { name: e.target.value })} /></TableCell>
                  <TableCell><Input className="w-28" value={r.code} onChange={(e) => update(i, { code: e.target.value.toUpperCase() })} /></TableCell>
                  <TableCell><Input className="w-24" type="number" step="0.1" value={r.rate} onChange={(e) => update(i, { rate: e.target.value as any })} /></TableCell>
                  <TableCell><Input value={r.description || ''} onChange={(e) => update(i, { description: e.target.value })} /></TableCell>
                  <TableCell><Switch checked={r.is_active} onCheckedChange={(v) => update(i, { is_active: v })} /></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => { if (r.id) setRemoved((x) => [...x, r.id!]); setRows((x) => x.filter((_, j) => j !== i)); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRows((r) => [...r, { name: '', code: '', rate: 0, description: '', is_active: true, sort_order: r.length + 1 }])}>
              <Plus className="h-4 w-4 mr-2" />Add Tax
            </Button>
            <Button onClick={save}><Save className="h-4 w-4 mr-2" />Save</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
