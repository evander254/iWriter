/** Currency / number / date formatting helpers used across iWriter. */

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat("en-US");

export function formatCurrency(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return currencyFormatter.format(0);
  return currencyFormatter.format(n);
}

/** Compact currency for chart axes: $1.2K */
export function formatCurrencyCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "$0";
  if (Math.abs(value) >= 1000) return `$${compactFormatter.format(value)}`;
  return currencyFormatter.format(value);
}

export function formatNumber(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  if (n === null || n === undefined || Number.isNaN(n)) return "0";
  return numberFormatter.format(n);
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0";
  if (Math.abs(value) < 1000) return String(value);
  return compactFormatter.format(value);
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0%";
  return `${value.toFixed(digits)}%`;
}

/** "1,250 words" */
export function formatWords(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${numberFormatter.format(value)} words`;
}

/** Short label used for counts like "3 pages". */
export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}
