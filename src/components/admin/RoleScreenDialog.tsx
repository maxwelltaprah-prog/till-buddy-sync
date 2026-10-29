import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SCREENS, STAFF_ROLES, screenEnabled, type ScreenOverride } from '@/lib/screenAccess';
import { ROLE_LABELS } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function RoleScreenDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { store, screenOverrides, refreshProfile } = useAuth();
  const [draft, setDraft] = useState<ScreenOverride[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setDraft(screenOverrides); }, [open, screenOverrides]);
  const save = async () => {
    if (!store) return;
    setSaving(true);
    try {
      const rows = STAFF_ROLES.flatMap(role => SCREENS.map(screen => ({ store_id: store.id, role, screen: screen.path, enabled: screenEnabled(role, screen.path, draft) })));
      const { error } = await supabase.from('role_screen_access').upsert(rows, { onConflict: 'store_id,role,screen' });
      if (error) throw error;
      await refreshProfile();
      toast.success('Role screen access saved');
      onOpenChange(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save screen access'); }
    finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={value => { if (!saving) onOpenChange(value); }}>
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>User Role Account Control</DialogTitle></DialogHeader>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Screen</TableHead>{STAFF_ROLES.map(role => <TableHead key={role} className="text-center">{ROLE_LABELS[role]}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{SCREENS.map(screen => <TableRow key={screen.path}>
            <TableCell className="font-medium whitespace-nowrap">{screen.label}</TableCell>
            {STAFF_ROLES.map(role => <TableCell key={role} className="text-center"><Switch
              aria-label={`${ROLE_LABELS[role]}: ${screen.label}`}
              checked={screenEnabled(role, screen.path, draft)} disabled={saving}
              onCheckedChange={enabled => setDraft(current => [...current.filter(row => row.role !== role || row.screen !== screen.path), { role, screen: screen.path, enabled }])}
            /></TableCell>)}
          </TableRow>)}</TableBody>
        </Table>
      </div>
      <DialogFooter><Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={saving} onClick={save}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save access</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}