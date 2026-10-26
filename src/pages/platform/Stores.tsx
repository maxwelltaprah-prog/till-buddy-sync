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
import { Loader2, Plus, LogIn, MoreHorizontal, KeyRound, Power, Archive } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogDescription } from '@/components/ui/dialog';

interface StoreRow { id: string; name: string; phone: string | null; email: string | null; is_active: boolean; created_at: string; archived_at: string | null }

const empty = { storeName: '', fullName: '', phone: '', email: '', password: '' };

export default function Stores() {
  const { isPlatformOwner, store, isLoading } = useAuth();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<{ type: 'password' | 'status' | 'archive'; store: StoreRow } | null>(null);
  const [admins, setAdmins] = useState<{ user_id: string; full_name: string; email: string }[]>([]);
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [actionError, setActionError] = useState('');
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from('stores').select('*').is('archived_at', null).order('created_at');
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

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('manage-users', { body });
    if (error) {
      let message = error.message;
      try { const response = await (error as unknown as { context?: Response }).context?.json(); message = response?.error || message; } catch { /* no JSON response */ }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const beginAction = async (type: 'password' | 'status' | 'archive', target: StoreRow) => {
    setAction({ type, store: target }); setActionError(''); setPassword(''); setConfirmPassword(''); setConfirmName(''); setAdminId(''); setAdmins([]);
    if (type !== 'password') return;
    setLoadingAdmins(true);
    try {
      const result = await invoke({ action: 'list_store_admins', storeId: target.id });
      setAdmins(result.admins || []);
      if (result.admins?.length === 1) setAdminId(result.admins[0].user_id);
    } catch (e) { setActionError(e instanceof Error ? e.message : 'Unable to load administrators'); }
    finally { setLoadingAdmins(false); }
  };

  const performAction = async () => {
    if (!action) return;
    if (action.type === 'password' && (!adminId || password.length < 6 || password !== confirmPassword)) {
      setActionError('Select an administrator and enter matching passwords of at least 6 characters.'); return;
    }
    setBusy(true); setActionError('');
    try {
      await invoke(action.type === 'password'
        ? { action: 'reset_store_password', storeId: action.store.id, userId: adminId, password }
        : action.type === 'archive'
          ? { action: 'archive_store', storeId: action.store.id, confirmName }
          : { action: 'set_store_status', storeId: action.store.id, active: !action.store.is_active });
      toast.success(action.type === 'password' ? 'Administrator password changed.' : action.type === 'archive' ? 'Store archived. All records have been preserved.' : action.store.is_active ? 'Store deactivated.' : 'Store activated.');
      setAction(null); setPassword(''); setConfirmPassword(''); await load();
    } catch (e) { setActionError(e instanceof Error ? e.message : 'Unable to update the store'); }
    finally { setBusy(false); }
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
              <TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {stores.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name} {s.id === store?.id && <Badge className="ml-2">Current</Badge>}</TableCell>
                  <TableCell>{s.phone ?? '—'}</TableCell>
                  <TableCell>{s.email ?? '—'}</TableCell>
                  <TableCell><Badge variant={s.is_active ? 'secondary' : 'outline'}>{s.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                  <TableCell>{new Date(s.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="outline" disabled={s.id === store?.id || !s.is_active} onClick={() => enter(s.id)}>
                      <LogIn className="mr-2 h-4 w-4" />Enter store
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Manage ${s.name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => void beginAction('password', s)}><KeyRound className="mr-2 h-4 w-4" />Change admin password</DropdownMenuItem>
                        <DropdownMenuItem disabled={s.id === store?.id && s.is_active} onSelect={() => void beginAction('status', s)}><Power className="mr-2 h-4 w-4" />{s.is_active ? 'Deactivate store' : 'Activate store'}</DropdownMenuItem>
                        <DropdownMenuItem disabled={s.id === store?.id} className="text-destructive focus:text-destructive" onSelect={() => void beginAction('archive', s)}><Archive className="mr-2 h-4 w-4" />Delete store (archive)</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
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
      <Dialog open={Boolean(action)} onOpenChange={value => { if (!value && !busy) { setAction(null); setPassword(''); setConfirmPassword(''); } }}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
          <DialogHeader>
            <DialogTitle>{action?.type === 'password' ? 'Change store admin password' : action?.type === 'archive' ? 'Archive store' : action?.store.is_active ? 'Deactivate store' : 'Activate store'}</DialogTitle>
            <DialogDescription>{action?.store.name}</DialogDescription>
          </DialogHeader>
          {action?.type === 'password' ? <div className="space-y-4">
            {loadingAdmins ? <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading administrators…</div> : admins.length ? <>
              <div className="space-y-2"><Label htmlFor="store-admin">Administrator</Label><Select value={adminId} onValueChange={setAdminId}><SelectTrigger id="store-admin"><SelectValue placeholder="Select administrator" /></SelectTrigger><SelectContent>{admins.map(a => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name} · {a.email}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="store-password">New password</Label><Input id="store-password" type="password" autoComplete="new-password" maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="store-password-confirm">Confirm password</Label><Input id="store-password-confirm" type="password" autoComplete="new-password" maxLength={128} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></div>
            </> : <p className="text-sm text-muted-foreground">No store administrator account is available. Platform owner passwords are changed from My Profile.</p>}
          </div> : action?.type === 'archive' ? <div className="space-y-4"><p className="text-sm text-muted-foreground">The store will be removed from this list and staff access will be blocked. Sales, products and all other records will be preserved.</p><div className="space-y-2"><Label htmlFor="archive-confirm">Type “{action.store.name}” to confirm</Label><Input id="archive-confirm" value={confirmName} onChange={e => setConfirmName(e.target.value)} autoComplete="off" /></div></div> : <p className="text-sm text-muted-foreground">{action?.store.is_active ? 'Staff access will be blocked, including existing sessions. All store records will be preserved.' : 'Store staff will be able to sign in and work again.'}</p>}
          {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
          <DialogFooter className="gap-2"><Button variant="outline" disabled={busy} onClick={() => { setAction(null); setPassword(''); setConfirmPassword(''); }}>Cancel</Button><Button variant={action?.type === 'archive' ? 'destructive' : 'default'} disabled={busy || loadingAdmins || (action?.type === 'password' && (!adminId || !admins.length)) || (action?.type === 'archive' && confirmName !== action.store.name)} onClick={() => void performAction()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{action?.type === 'password' ? 'Change password' : action?.type === 'archive' ? 'Archive store' : action?.store.is_active ? 'Deactivate store' : 'Activate store'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
