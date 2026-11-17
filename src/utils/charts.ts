import { dayKey, lastDays, lastMonths, monthKey } from "./date";

export type RangePreset = "7d" | "30d" | "90d" | "12m";

export const RANGE_OPTIONS: Array<{ value: RangePreset; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
];

export function rangeStart(range: RangePreset): Date {
  const d = new Date();
  if (range === "7d") d.setDate(d.getDate() - 7);
  else if (range === "30d") d.setDate(d.getDate() - 30);
  else if (range === "90d") d.setDate(d.getDate() - 90);
  else d.setMonth(d.getMonth() - 12);
  return d;
}

/**
 * Bucket dated points into a continuous series (no gaps) for charts.
 * `7d/30d/90d` bucket by day; `12m` buckets by month.
 */
export function buildTimeSeries(
  points: Array<{ created_at: string; amount: number }>,
  range: RangePreset,
): Array<{ label: string; value: number }> {
  const monthly = range === "12m";
  const buckets = monthly ? lastMonths(12) : lastDays(range === "7d" ? 7 : range === "30d" ? 30 : 90);
  const totals = new Map<string, number>();

  for (const point of points) {
    const key = monthly ? monthKey(point.created_at) : dayKey(point.created_at);
    if (!key) continue;
    totals.set(key, (totals.get(key) ?? 0) + point.amount);
  }

  return buckets.map((bucket) => ({
    label: bucket.label,
    value: Number((totals.get(bucket.key) ?? 0).toFixed(2)),
  }));
}

/** Bucket generic records (with a timestamp) by day or month. */
export function buildCountSeries<T>(
  rows: T[],
  timestampOf: (row: T) => string | null | undefined,
  range: RangePreset,
): Array<{ label: string; value: number }> {
  const monthly = range === "12m";
  const buckets = monthly ? lastMonths(12) : lastDays(range === "7d" ? 7 : range === "30d" ? 30 : 90);
  const totals = new Map<string, number>();

  for (const row of rows) {
    const raw = timestampOf(row);
    if (!raw) continue;
    const key = monthly ? monthKey(raw) : dayKey(raw);
    if (!key) continue;
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }

  return buckets.map((bucket) => ({ label: bucket.label, value: totals.get(bucket.key) ?? 0 }));
}
