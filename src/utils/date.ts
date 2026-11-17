/** Date / time helpers built on native Date + Intl (no heavy deps). */

export function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

export function formatDate(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? dateFormatter.format(d) : "—";
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? dateTimeFormatter.format(d) : "—";
}

export function formatTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? timeFormatter.format(d) : "—";
}

/** "2 days ago", "in 3 hours" */
export function formatRelative(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  if (abs < minute) return rtf.format(Math.round(diff / 1000), "second");
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < week) return rtf.format(Math.round(diff / day), "day");
  if (abs < month) return rtf.format(Math.round(diff / week), "week");
  if (abs < year) return rtf.format(Math.round(diff / month), "month");
  return rtf.format(Math.round(diff / year), "year");
}

export type DeadlineUrgency = "overdue" | "critical" | "soon" | "normal" | "none";

/** Classify a deadline for colour coding. */
export function deadlineUrgency(value: string | number | Date | null | undefined): DeadlineUrgency {
  const d = toDate(value);
  if (!d) return "none";
  const ms = d.getTime() - Date.now();
  if (ms < 0) return "overdue";
  const hours = ms / 3_600_000;
  if (hours <= 24) return "critical";
  if (hours <= 72) return "soon";
  return "normal";
}

/** Human countdown like "3d 4h left" or "Overdue by 2h". */
export function formatCountdown(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  const ms = d.getTime() - Date.now();
  const overdue = ms < 0;
  let s = Math.abs(ms) / 1000;
  const days = Math.floor(s / 86400);
  s -= days * 86400;
  const hours = Math.floor(s / 3600);
  s -= hours * 3600;
  const minutes = Math.floor(s / 60);

  let label: string;
  if (days > 0) label = `${days}d ${hours}h`;
  else if (hours > 0) label = `${hours}h ${minutes}m`;
  else label = `${minutes}m`;

  return overdue ? `Overdue by ${label}` : `${label} left`;
}

/** First day of the current month (ISO date string). */
export function startOfMonthISO(date = new Date()): string {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
}

/** ISO date for N days ago. */
export function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/** Format a Date as yyyy-mm-dd for <input type="date">. */
export function toDateInputValue(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

/** Format a Date as yyyy-mm-ddThh:mm for <input type="datetime-local">. */
export function toDateTimeInputValue(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

/** Build an array of month buckets for charts: [{ key, label }] */
export function lastMonths(count: number): Array<{ key: string; label: string }> {
  const out: Array<{ key: string; label: string }> = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-US", { month: "short" }),
    });
  }
  return out;
}

/** Build an array of day buckets for charts. */
export function lastDays(count: number): Array<{ key: string; label: string }> {
  const out: Array<{ key: string; label: string }> = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      label: d.toLocaleString("en-US", { month: "short", day: "numeric" }),
    });
  }
  return out;
}

/** Convert a date to the bucket key used by lastMonths(). */
export function monthKey(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Convert a date to the bucket key used by lastDays(). */
export function dayKey(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
