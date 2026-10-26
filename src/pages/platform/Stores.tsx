import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, Plus, LogIn } from 'lucide-react';

interface StoreRow { id: string; name: string; phone: string | null; email: string | null; is_active: boolean; created_at: string }

const empty = { storeName: '', fullName: '', phone: '', email: '', password: '' };

export default function Stores() {
  const { isPlatformOwner, store, isLoading } = useAuth();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from('stores').select('*').order('created_at');
    if (error) toast.error(error.message);
    setStores((data as StoreRow[]) ?? []);
  };

  useEffect(() => { if (isPlatformOwner) load(); }, [isPlatformOwner]);

  if (isLoading) return null;
  if (!isPlatformOwner) return <Navigate to="/" replace />;

  const create = async () => {
    if (form.storeName.trim().length < 2 || form.fullName.trim().length < 2 || !form.email || form.password.length < 6) {
      toast.error('Fill in store name, admin name, email and a password of at least 6 characters');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('manage-users', { body: { action: 'create_store', ...form } });
    let msg = data?.error;
    if (error && !msg) { try { msg = (await (error as any).context?.json())?.error; } catch { /* ignore */ } msg = msg || error.message; }
    setBusy(false);
    if (msg) { toast.error(msg); return; }
    toast.success('Store created. The store admin can sign in now.');
    setForm(empty);
    setOpen(false);
    load();
  };

  const enter = async (id: string) => {
    const { error } = await supabase.rpc('switch_store' as any, { _store_id: id });
    if (error) { toast.error(error.message); return; }
    window.location.href = '/';
  };

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stores</h1>
          <p className="text-muted-foreground">Each store has its own branches, staff, products and sales.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />New Store</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All stores</CardTitle>
          <CardDescription>You are currently working in: <strong>{store?.name ?? '—'}</strong></CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead>Created</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {stores.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name} {s.id === store?.id && <Badge className="ml-2">Current</Badge>}</TableCell>
                  <TableCell>{s.phone ?? '—'}</TableCell>
                  <TableCell>{s.email ?? '—'}</TableCell>
                  <TableCell>{new Date(s.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" disabled={s.id === store?.id} onClick={() => enter(s.id)}>
                      <LogIn className="mr-2 h-4 w-4" />Enter store
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New store account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Store name</Label><Input value={form.storeName} onChange={set('storeName')} /></div>
            <div className="space-y-1"><Label>Store admin full name</Label><Input value={form.fullName} onChange={set('fullName')} /></div>
            <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={set('phone')} /></div>
            <div className="space-y-1"><Label>Admin email (login)</Label><Input type="email" value={form.email} onChange={set('email')} /></div>
            <div className="space-y-1"><Label>Password</Label><Input type="password" value={form.password} onChange={set('password')} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create store</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
