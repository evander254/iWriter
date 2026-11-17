import { supabase } from "../lib/supabase";
import { ApiError, friendlyError, pageRange, sanitizeSearch, unwrap, unwrapList } from "./api";
import type { AccountStatus, AppRole, Profile } from "../types";
import type { ListParams, Paginated } from "../types/models";

export interface WriterFilters extends ListParams {
  status?: AccountStatus | AccountStatus[];
  role?: AppRole;
}

export async function listWriters(filters: WriterFilters = {}): Promise<Paginated<Profile>> {
  const { page = 1, pageSize = 12, search, sortBy = "created_at", sortDir = "desc" } = filters;
  const [from, to] = pageRange(page, pageSize);

  let query = supabase.from("profiles").select("*", { count: "exact" }).eq("role", filters.role ?? "writer");

  if (filters.status) {
    if (Array.isArray(filters.status)) query = query.in("status", filters.status);
    else query = query.eq("status", filters.status);
  }
  if (search) {
    const term = sanitizeSearch(search);
    if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  }

  query = query.order(sortBy, { ascending: sortDir === "asc" }).range(from, to);
  const { data, error, count } = await query;
  return { rows: unwrapList(data as Profile[] | null, error), count: count ?? 0, page, pageSize };
}

export async function getProfile(id: string): Promise<Profile> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();
  return unwrap(data as Profile | null, error, "profile");
}

export async function getMyProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) return null;
  return (data as Profile) ?? null;
}

/** Fields a user is allowed to change about themselves (matches column grants). */
export interface ProfileUpdateInput {
  full_name?: string | null;
  phone?: string | null;
  country?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
}

export async function updateMyProfile(id: string, input: ProfileUpdateInput): Promise<Profile> {
  const { data, error } = await supabase.from("profiles").update(input).eq("id", id).select("*").single();
  return unwrap(data as Profile | null, error, "profile");
}

/** Admin: suspend / reactivate via the guarded RPC. */
export async function setWriterStatus(userId: string, status: AccountStatus): Promise<void> {
  const { error } = await supabase.rpc("admin_set_writer_status", {
    p_user_id: userId,
    p_status: status,
  });
  if (error) throw new ApiError(friendlyError(error), error);
}

/** Admin: manual balance adjustment (bonus / penalty). */
export async function adjustBalance(userId: string, amount: number, reason: string): Promise<void> {
  const { error } = await supabase.rpc("admin_adjust_balance", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
  });
  if (error) throw new ApiError(friendlyError(error), error);
}

export interface WriterSummary {
  profile: Profile;
  totalClaims: number;
  activeClaims: number;
  approvedClaims: number;
  submissions: number;
  pendingWithdrawals: number;
}

export async function getWriterSummary(writerId: string): Promise<WriterSummary | null> {
  const profile = await getMyProfile(writerId);
  if (!profile) return null;

  const [claimsRes, submissionsRes, withdrawalsRes] = await Promise.all([
    supabase.from("assignment_claims").select("status").eq("writer_id", writerId),
    supabase.from("assignment_claims").select("id").eq("writer_id", writerId),
    supabase
      .from("withdrawal_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", writerId)
      .eq("status", "pending"),
  ]);

  const claims = claimsRes.data ?? [];
  const claimIds = (submissionsRes.data ?? []).map((c) => c.id);
  let submissionCount = 0;
  if (claimIds.length > 0) {
    const { count } = await supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .in("claim_id", claimIds);
    submissionCount = count ?? 0;
  }

  return {
    profile,
    totalClaims: claims.length,
    activeClaims: claims.filter((c) => c.status === "claimed" || c.status === "submitted" || c.status === "revision").length,
    approvedClaims: claims.filter((c) => c.status === "approved").length,
    submissions: submissionCount,
    pendingWithdrawals: withdrawalsRes.count ?? 0,
  };
}

export async function listRecentRegistrations(limit = 6): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "writer")
    .order("created_at", { ascending: false })
    .limit(limit);
  return unwrapList(data as Profile[] | null, error);
}

export async function countProfiles(): Promise<{ total: number; active: number; suspended: number }> {
  const [total, active, suspended] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "writer"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "writer").eq("status", "active"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "writer").eq("status", "suspended"),
  ]);
  return {
    total: total.count ?? 0,
    active: active.count ?? 0,
    suspended: suspended.count ?? 0,
  };
}
