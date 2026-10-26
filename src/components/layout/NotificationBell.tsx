import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarClock, HandCoins } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const { items, isLoading } = useNotifications();
  const announced = useRef(false);
  const critical = items.filter((i) => i.severity === 'critical').length;

  // One summary alert per browser session when there is something to act on.
  useEffect(() => {
    if (isLoading || announced.current || items.length === 0) return;
    announced.current = true;
    if (sessionStorage.getItem('notices_shown')) return;
    sessionStorage.setItem('notices_shown', '1');
    const exp = items.filter((i) => i.kind === 'expired' || i.kind === 'expiring').length;
    const cred = items.length - exp;
    const parts = [exp && `${exp} product batch${exp === 1 ? '' : 'es'} expired or expiring`, cred && `${cred} credit${cred === 1 ? '' : 's'} due or overdue`].filter(Boolean);
    (critical ? toast.error : toast.warning)(`Attention: ${parts.join(' and ')}`, { duration: 8000 });
  }, [isLoading, items, critical]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {items.length > 0 && (
            <span className={cn(
              'absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold',
              critical ? 'bg-destructive text-destructive-foreground' : 'bg-warning text-warning-foreground',
            )}>
              {items.length > 99 ? '99+' : items.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="border-b px-4 py-3">
          <p className="font-semibold">Notifications</p>
          <p className="text-xs text-muted-foreground">Expiring stock and creditor repayments</p>
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {isLoading ? 'Checking…' : 'All clear — nothing needs attention.'}
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <ul className="divide-y">
              {items.map((n) => {
                const Icon = n.kind.startsWith('credit') ? HandCoins : CalendarClock;
                return (
                  <li key={n.id}>
                    <Link to={n.link} className="flex gap-3 px-4 py-3 hover:bg-muted/60">
                      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', n.severity === 'critical' ? 'text-destructive' : 'text-warning')} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{n.detail}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
