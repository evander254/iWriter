import type { PostgrestError } from "@supabase/supabase-js";

/** Error thrown by the service layer, carrying a user-friendly message. */
export class ApiError extends Error {
  code?: string;
  details?: string;
  hint?: string;

  constructor(message: string, error?: PostgrestError | null) {
    super(message);
    this.name = "ApiError";
    this.code = error?.code;
    this.details = error?.details ?? undefined;
    this.hint = error?.hint ?? undefined;
  }
}

/** Translate a PostgREST/Postgres error into a readable message. */
export function friendlyError(error: PostgrestError | null | undefined): string {
  if (!error) return "Something went wrong. Please try again.";
  const message = error.message ?? "";
  const code = error.code ?? "";

  if (code === "42501" || /row-level security/i.test(message)) {
    return "You don't have permission to perform this action.";
  }
  if (code === "23505" || /duplicate key/i.test(message)) {
    if (/assignment_claims_unique_writer/i.test(message)) return "You have already claimed this assignment.";
    if (/transactions_earning_unique/i.test(message)) return "These earnings have already been credited.";
    if (/subjects_name_key/i.test(message)) return "A subject with that name already exists.";
    if (/categories_name_key/i.test(message)) return "A category with that name already exists.";
    if (/assignments_assignment_code_key/i.test(message)) return "That assignment code is already in use.";
    if (/settings_setting_key_key/i.test(message)) return "That setting already exists.";
    return "That record already exists.";
  }
  if (code === "23503") return "This record references something that no longer exists.";
  if (code === "23502") return "A required field is missing.";
  if (code === "23514" || /violates check constraint/i.test(message)) {
    return "One of the values you entered is not allowed.";
  }
  if (code === "P0001" || code === "P0002" || code === "22023" || code === "28000") {
    return message; // raised by our own RPCs with a friendly message
  }
  if (/JWT|token/i.test(message)) return "Your session has expired. Please sign in again.";
  if (/fetch|network/i.test(message)) return "Network error. Check your connection and try again.";
  return message || "Something went wrong. Please try again.";
}

/** Unwrap a Supabase response, throwing an ApiError on failure. */
export function unwrap<T>(data: T | null, error: PostgrestError | null, context = "request"): T {
  if (error) throw new ApiError(friendlyError(error), error);
  if (data === null) throw new ApiError(`The ${context} returned no data.`);
  return data;
}

/** Unwrap a list response, defaulting to an empty array. */
export function unwrapList<T>(data: T[] | null, error: PostgrestError | null): T[] {
  if (error) throw new ApiError(friendlyError(error), error);
  return data ?? [];
}

/** Build a PostgREST range for a 1-based page. */
export function pageRange(page: number, pageSize: number): [number, number] {
  const from = (Math.max(1, page) - 1) * pageSize;
  return [from, from + pageSize - 1];
}

/** Sanitise a search term for use inside a PostgREST `or()` filter. */
export function sanitizeSearch(term: string): string {
  return term.replace(/[,%()\\]/g, " ").trim();
}

/** Generate a human-readable assignment code: IW-YYMM-XXXX */
export function generateAssignmentCode(): string {
  const now = new Date();
  const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `IW-${yymm}-${rand}`;
}
