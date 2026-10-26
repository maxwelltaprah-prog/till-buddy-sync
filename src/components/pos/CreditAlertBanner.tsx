import { Link } from 'react-router-dom';
import { AlertTriangle, Clock } from 'lucide-react';
import { useOutstandingCredit } from '@/hooks/useCreditAccounts';

/** Compact strip on the POS telling the cashier about overdue and soon-due creditors. */
export function CreditAlertBanner() {
  const { rows } = useOutstandingCredit();
  const overdue = rows.filter((r) => r.status === 'overdue');
  const due = rows.filter((r) => r.status === 'due_soon' || r.status === 'due_today');
  if (!overdue.length && !due.length) return null;
  const names = (xs: typeof rows) => [...new Set(xs.map((x) => x.customer?.name))].slice(0, 3).join(', ');

  return (
    <Link to="/creditors" className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b bg-warning/10 px-4 py-2 text-sm hover:bg-warning/15">
      {overdue.length > 0 && (
        <span className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <strong>{overdue.length} overdue credit{overdue.length === 1 ? '' : 's'}</strong>
          <span className="text-muted-foreground">{names(overdue)}</span>
        </span>
      )}
      {due.length > 0 && (
        <span className="flex items-center gap-2 text-warning">
          <Clock className="h-4 w-4" />
          <strong>{due.length} due soon</strong>
          <span className="text-muted-foreground">{names(due)}</span>
        </span>
      )}
    </Link>
  );
}
