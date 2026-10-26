import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { useShopSettings } from '@/contexts/ShopSettingsContext';
import { useCurrency } from '@/hooks/useCurrency';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Printer, FileDown, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { receiptCashierName } from '@/lib/cashier';
import { transactionReceipt, transactionTaxLines } from '@/lib/transactionReceipt';
import { generateReceiptPDF, printThermalReceipt } from '@/lib/receiptGenerator';

interface Details {
  sale: Tables<'sales'>;
  items: Tables<'sale_items'>[];
  branch: Pick<Tables<'branches'>, 'name' | 'address'>;
  cashier: string | null;
  credit: (Tables<'credit_sales'> & { customerName: string }) | null;
}

export function TransactionDetailsDialog({ saleId, onClose }: { saleId: string | null; onClose: () => void }) {
  const { store } = useAuth();
  const { settings } = useShopSettings();
  const { formatPrice, code } = useCurrency();
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    let active = true;
    setDetails(null);
    setError('');
    if (!saleId || !store?.id) return;
    setLoading(true);
    const load = async () => {
      try {
        const [saleResult, itemsResult] = await Promise.all([
          supabase.from('sales').select('*').eq('id', saleId).eq('store_id', store.id).single(),
          supabase.from('sale_items').select('*').eq('sale_id', saleId).eq('store_id', store.id).order('created_at'),
        ]);
        if (saleResult.error) throw saleResult.error;
        if (itemsResult.error) throw itemsResult.error;
        const sale = saleResult.data;
        const [branchResult, cashierResult, creditResult] = await Promise.all([
          supabase.from('branches').select('name, address').eq('id', sale.branch_id).eq('store_id', store.id).single(),
          supabase.from('profiles').select('full_name').eq('user_id', sale.cashier_id).maybeSingle(),
          sale.payment_method === 'credit'
            ? supabase.from('credit_sales').select('*').eq('sale_id', saleId).eq('store_id', store.id).single()
            : Promise.resolve({ data: null, error: null }),
        ]);
        if (branchResult.error) throw branchResult.error;
        if (cashierResult.error) throw cashierResult.error;
        if (creditResult.error) throw creditResult.error;
        let credit: Details['credit'] = null;
        if (creditResult.data) {
          const customer = await supabase.from('credit_customers').select('name').eq('id', creditResult.data.customer_id).eq('store_id', store.id).single();
          if (customer.error) throw customer.error;
          credit = { ...creditResult.data, customerName: customer.data.name };
        }
        if (active) setDetails({ sale, items: itemsResult.data, branch: branchResult.data, cashier: cashierResult.data?.full_name || null, credit });
      } catch {
        if (active) setError('This transaction could not be loaded. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [saleId, store?.id, retry]);

  const print = async (pdf: boolean) => {
    if (!details) return;
    setPrinting(true);
    try {
      const { sale, items, branch, cashier, credit } = details;
      const receipt = transactionReceipt(sale, items, branch, cashier, {
        shopName: settings.shop_name, tagline: settings.tagline, logoUrl: settings.logo_url,
        receiptHeader: settings.receipt_header, receiptFooter: settings.receipt_footer,
        currencySymbol: settings.currency_symbol, currencyCode: settings.currency_code,
        primaryColor: settings.primary_color, phone: settings.phone, email: settings.email, address: settings.address,
      }, credit ? { customerName: credit.customerName, dueDate: credit.due_date, days: credit.repayment_days } : undefined);
      await (pdf ? generateReceiptPDF(receipt) : printThermalReceipt(receipt));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to open the receipt.');
    } finally { setPrinting(false); }
  };

  const moneyRow = (label: string, amount: number) => <div className="flex justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="font-medium tabular-nums">{formatPrice(amount)}</span></div>;

  return (
    <Dialog open={Boolean(saleId)} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-lg p-0">
        <DialogHeader className="border-b px-5 py-5 pr-12 text-left sm:px-6">
          <DialogTitle>Transaction details</DialogTitle>
          <DialogDescription className="break-all">{details?.sale.receipt_number || 'Sale items and payment details'}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto">
          {loading ? <div role="status" className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading transaction…</div> : error ? (
            <div role="alert" className="flex flex-col items-center gap-3 p-8 text-center"><AlertCircle className="h-6 w-6 text-destructive" /><p className="text-sm">{error}</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}>Try again</Button></div>
          ) : details ? (<>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-5 text-sm sm:grid-cols-4 sm:px-6">
              <div><dt className="mb-1 text-xs text-muted-foreground">Date & time</dt><dd>{details.sale.created_at ? format(new Date(details.sale.created_at), 'dd MMM yyyy · HH:mm') : 'Unavailable'}</dd></div>
              <div><dt className="mb-1 text-xs text-muted-foreground">Cashier</dt><dd className="break-words font-medium">{receiptCashierName(details.cashier)}</dd></div>
              <div><dt className="mb-1 text-xs text-muted-foreground">Branch</dt><dd className="break-words">{details.branch.name}</dd></div>
              <div><dt className="mb-1 text-xs text-muted-foreground">Status</dt><dd className="capitalize">{details.sale.status || 'Unavailable'}</dd></div>
            </dl>
            <h3 className="border-t px-5 pt-4 text-sm font-semibold sm:px-6">Sale items <span className="ml-1 font-normal text-muted-foreground">({details.items.length})</span></h3>
            <Table>
              <TableHeader><TableRow><TableHead className="pl-5 sm:pl-6">Item</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="hidden text-right sm:table-cell">Unit price</TableHead><TableHead className="pr-5 text-right sm:pr-6">Total</TableHead></TableRow></TableHeader>
              <TableBody>{details.items.length ? details.items.map(item => <TableRow key={item.id}>
                <TableCell className="pl-5 sm:pl-6"><p className="break-words font-medium">{item.product_name}</p><p className="mt-1 text-xs text-muted-foreground">{item.is_bulk_price ? 'Bulk' : 'Retail'}<span className="sm:hidden"> · {formatPrice(item.unit_price)} each</span></p></TableCell>
                <TableCell className="text-right tabular-nums">{item.quantity}</TableCell><TableCell className="hidden whitespace-nowrap text-right tabular-nums sm:table-cell">{formatPrice(item.unit_price)}</TableCell><TableCell className="whitespace-nowrap pr-5 text-right font-medium tabular-nums sm:pr-6">{formatPrice(item.total)}</TableCell>
              </TableRow>) : <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No saved items are available.</TableCell></TableRow>}</TableBody>
            </Table>
            <div className="grid gap-6 border-t px-5 py-5 text-sm sm:grid-cols-2 sm:px-6">
              <section className="space-y-3"><h3 className="font-semibold">Payment details</h3><div className="flex justify-between"><span className="text-muted-foreground">Method</span><span className="capitalize">{details.sale.payment_method}</span></div>
                {details.credit ? <><div><p className="text-xs text-muted-foreground">Creditor</p><p className="mt-1 font-medium">{details.credit.customerName}</p></div><div className="flex justify-between gap-3"><span className="text-muted-foreground">Repay by</span><span>{format(new Date(`${details.credit.due_date}T00:00:00`), 'dd MMM yyyy')} · {details.credit.repayment_days} days</span></div>{moneyRow('Repaid to date', details.credit.amount_paid)}{moneyRow('Outstanding', details.credit.amount - details.credit.amount_paid)}</> : <>{moneyRow('Cash received', details.sale.cash_received || 0)}{moneyRow('Change given', details.sale.change_given || 0)}</>}
                <p className="text-xs text-muted-foreground">All amounts in {code}</p>
              </section>
              <section className="space-y-3"><h3 className="font-semibold">Payment breakdown</h3>{moneyRow('Subtotal', details.sale.subtotal)}{Boolean(details.sale.discount_amount) && moneyRow('Discount', details.sale.discount_amount || 0)}{transactionTaxLines(details.sale, details.items).map(line => <div key={`${line.code}:${line.rate}`} className="flex justify-between gap-3"><span className="text-muted-foreground">{line.name} ({line.rate}%)</span><span className="tabular-nums">{formatPrice(line.amount)}</span></div>)}{moneyRow('Total tax', details.sale.tax_amount || 0)}<div className="flex justify-between border-t pt-3 text-base font-semibold"><span>Total</span><span className="tabular-nums">{formatPrice(details.sale.total)}</span></div></section>
            </div>
          </>) : null}
        </div>
        <footer className="flex flex-wrap justify-end gap-2 border-t bg-muted/20 px-5 py-4 sm:px-6">
          <Button variant="outline" disabled={!details?.items.length || printing} onClick={() => void print(false)}><Printer className="mr-2 h-4 w-4" /> Print receipt</Button>
          <Button disabled={!details?.items.length || printing} onClick={() => void print(true)}><FileDown className="mr-2 h-4 w-4" /> Save as PDF</Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}