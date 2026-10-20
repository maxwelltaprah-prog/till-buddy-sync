export interface AgeingThresholds { t1: number; t2: number; t3: number; }
export const DEFAULT_THRESHOLDS: AgeingThresholds = { t1: 3, t2: 4, t3: 6 };

export type AgeBucket = 'expired' | 'b1' | 'b2' | 'b3' | 'safe' | 'none';

export function daysUntil(date: string | null | undefined, today = new Date()): number | null {
  if (!date) return null;
  const d = new Date(date + 'T00:00:00');
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

export function addMonths(base: Date, m: number) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setMonth(d.getMonth() + m);
  return d;
}

export function ageBucket(expiry: string | null | undefined, th: AgeingThresholds, today = new Date()): AgeBucket {
  if (!expiry) return 'none';
  const e = new Date(expiry + 'T00:00:00');
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (e < t) return 'expired';
  if (e <= addMonths(t, th.t1)) return 'b1';
  if (e <= addMonths(t, th.t2)) return 'b2';
  if (e <= addMonths(t, th.t3)) return 'b3';
  return 'safe';
}

export function bucketLabel(b: AgeBucket, th: AgeingThresholds) {
  return {
    expired: 'Expired',
    b1: `≤ ${th.t1} months`,
    b2: `${th.t1}–${th.t2} months`,
    b3: `${th.t2}–${th.t3} months`,
    safe: `> ${th.t3} months`,
    none: 'No expiry',
  }[b];
}
