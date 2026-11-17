import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "writer";

export type AccountStatus = "active" | "suspended" | "inactive";

/**
 * `public.profiles` — matches the live iWriter schema exactly.
 *
 *   id uuid PK -> auth.users(id), full_name, email, avatar_url, phone, country,
 *   bio, role ('admin'|'writer'), status ('active'|'suspended'|'inactive'),
 *   total_earnings numeric, available_balance numeric, created_at, updated_at
 */
export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
  country: string | null;
  bio: string | null;
  role: AppRole;
  status: AccountStatus;
  total_earnings: number;
  available_balance: number;
  created_at: string;
  updated_at: string | null;
}

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
}

/** Coerce a raw `profiles` row into a fully-populated, type-safe object. */
export function normalizeProfile(
  raw: Record<string, unknown> | null | undefined,
  fallbackEmail?: string | null,
): Profile | null {
  if (!raw) return null;
  const num = (v: unknown) => {
    const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? "0"));
    return Number.isFinite(n) ? n : 0;
  };
  const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);

  return {
    id: String(raw.id ?? ""),
    full_name: str(raw.full_name),
    email: str(raw.email) ?? fallbackEmail ?? null,
    avatar_url: str(raw.avatar_url),
    phone: str(raw.phone),
    country: str(raw.country),
    bio: str(raw.bio),
    role: raw.role === "admin" ? "admin" : "writer",
    status:
      raw.status === "suspended" || raw.status === "inactive" ? (raw.status as AccountStatus) : "active",
    total_earnings: num(raw.total_earnings),
    available_balance: num(raw.available_balance),
    created_at: String(raw.created_at ?? new Date().toISOString()),
    updated_at: str(raw.updated_at),
  };
}

export function displayName(profile: Profile | null | undefined): string {
  if (!profile) return "User";
  return profile.full_name || profile.email || "User";
}
