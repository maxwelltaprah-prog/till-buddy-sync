import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';

interface ConfirmOptions { title: string; description: string; confirmLabel?: string }
interface Pending extends ConfirmOptions { resolve: (ok: boolean) => void }

let open: ((p: Pending) => void) | null = null;

/** Promise-based styled confirmation for destructive actions. */
export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!open) { resolve(window.confirm(`${opts.title}\n\n${opts.description}`)); return; }
    open({ ...opts, resolve });
  });
}

export function ConfirmDialogHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  useEffect(() => { open = setPending; return () => { open = null; }; }, []);
  const close = (ok: boolean) => { pending?.resolve(ok); setPending(null); };
  return (
    <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o) close(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1.5 text-left">
              <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
              <AlertDialogDescription>{pending?.description}</AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction className={buttonVariants({ variant: 'destructive' })} onClick={() => close(true)}>
            {pending?.confirmLabel || 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
