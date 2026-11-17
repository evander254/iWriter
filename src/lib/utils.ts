/** Join truthy class names. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Create a debounced version of a function. */
export function debounce<T extends (...args: never[]) => void>(fn: T, delay = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Deterministic-ish unique id for DOM keys. */
export function uid(prefix = "iw"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Return a new object containing only the defined, non-empty values. */
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  ) as Partial<T>;
}

/** Safely parse a number, returning fallback when invalid. */
export function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

/** Group an array by a key selector. */
export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K,
): Record<K, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = String(keyFn(item));
    (acc[key] ??= []).push(item);
    return acc;
  }, {}) as Record<K, T[]>;
}

/** Sort helper that is stable and null-safe. */
export function sortBy<T>(items: T[], keyFn: (item: T) => number | string, dir: "asc" | "desc" = "asc") {
  const factor = dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = keyFn(a);
    const bv = keyFn(b);
    if (av < bv) return -1 * factor;
    if (av > bv) return 1 * factor;
    return 0;
  });
}
