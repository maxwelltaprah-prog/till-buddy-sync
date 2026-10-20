export interface TaxComponent {
  id?: string;
  name: string;
  code: string;
  rate: number;
  is_active?: boolean;
}

export interface TaxLine {
  code: string;
  name: string;
  rate: number;
  amount: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Decoupled method: every active component is calculated on the taxable subtotal and summed. */
export function calculateTaxes(taxableSubtotal: number, components: TaxComponent[]) {
  const lines: TaxLine[] = components
    .filter((c) => c.is_active !== false)
    .map((c) => ({ code: c.code, name: c.name, rate: Number(c.rate), amount: round2(taxableSubtotal * (Number(c.rate) / 100)) }));
  const total = round2(lines.reduce((s, l) => s + l.amount, 0));
  const effectiveRate = lines.reduce((s, l) => s + l.rate, 0);
  return { lines, total, effectiveRate };
}
