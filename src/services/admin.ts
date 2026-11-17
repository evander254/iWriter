import { supabase } from "../lib/supabase";
import { unwrapList } from "./api";
import type { ActivityLogEntry, AssignmentHistoryEntry, Setting } from "../types/models";
import { countProfiles } from "./profiles";
import { getFinanceSummary } from "./finance";
import type { AdminStats, AssignmentStatus } from "../types/models";

/* ---------------- Activity logs ---------------- */

export async function listActivityLogs(limit = 50): Promise<ActivityLogEntry[]> {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("*, actor:profiles!activity_logs_user_id_fkey(*)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return unwrapList(data as ActivityLogEntry[] | null, error);
}

export async function logActivity(userId: string, activity: string): Promise<void> {
  try {
    await supabase.from("activity_logs").insert({ user_id: userId, activity });
  } catch {
    /* activity logging must never break a user flow */
  }
}

/* ---------------- Assignment history ---------------- */

export async function listRecentHistory(limit = 20): Promise<AssignmentHistoryEntry[]> {
  const { data, error } = await supabase
    .from("assignment_history")
    .select("*, actor:profiles!assignment_history_user_id_fkey(*), assignment:assignments(*)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return unwrapList(data as AssignmentHistoryEntry[] | null, error);
}

/* ---------------- Settings ---------------- */

export async function listSettings(): Promise<Setting[]> {
  const { data, error } = await supabase.from("settings").select("*").order("setting_key", { ascending: true });
  return unwrapList(data as Setting[] | null, error);
}

export async function upsertSetting(input: {
  setting_key: string;
  setting_value: string;
  description?: string | null;
}): Promise<Setting> {
  const { data, error } = await supabase
    .from("settings")
    .upsert(input, { onConflict: "setting_key" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Setting;
}

export async function deleteSetting(id: string): Promise<void> {
  await supabase.from("settings").delete().eq("id", id);
}

/* ---------------- Admin dashboard ---------------- */

export async function getAdminStats(): Promise<AdminStats> {
  const [
    writers,
    totalAssignments,
    availableAssignments,
    claimedAssignments,
    completedAssignments,
    pendingSubmissions,
    pendingRevisions,
    finance,
  ] = await Promise.all([
    countProfiles(),
    supabase.from("assignments").select("id", { count: "exact", head: true }),
    supabase.from("assignments").select("id", { count: "exact", head: true }).eq("status", "available"),
    supabase.from("assignments").select("id", { count: "exact", head: true }).in("status", ["claimed", "pending_review", "revision"]),
    supabase.from("assignments").select("id", { count: "exact", head: true }).in("status", ["approved", "completed"]),
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("revision_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    getFinanceSummary(),
  ]);

  return {
    totalWriters: writers.total,
    activeWriters: writers.active,
    suspendedWriters: writers.suspended,
    totalAssignments: totalAssignments.count ?? 0,
    availableAssignments: availableAssignments.count ?? 0,
    claimedAssignments: claimedAssignments.count ?? 0,
    completedAssignments: completedAssignments.count ?? 0,
    pendingSubmissions: pendingSubmissions.count ?? 0,
    pendingRevisions: pendingRevisions.count ?? 0,
    totalWriterEarnings: finance.totalEarnings,
    totalWithdrawals: finance.paidWithdrawals + finance.approvedWithdrawals,
    pendingWithdrawals: finance.pendingWithdrawalCount,
  };
}

/** Assignment counts grouped by status (for the activity chart). */
export async function getAssignmentStatusCounts(): Promise<Record<AssignmentStatus, number>> {
  const { data } = await supabase.from("assignments").select("status");
  const base = {
    draft: 0,
    available: 0,
    claimed: 0,
    pending_review: 0,
    revision: 0,
    approved: 0,
    completed: 0,
    cancelled: 0,
    expired: 0,
  } as Record<AssignmentStatus, number>;
  for (const row of data ?? []) {
    const s = row.status as AssignmentStatus;
    if (s in base) base[s] += 1;
  }
  return base;
}

export async function getPlatformActivitySeries(): Promise<Array<{ month: string; assignments: number; claims: number }>> {
  const [assignmentsRes, claimsRes] = await Promise.all([
    supabase.from("assignments").select("created_at"),
    supabase.from("assignment_claims").select("claimed_at"),
  ]);

  const buckets: Record<string, { assignments: number; claims: number }> = {};
  const keyOf = (value: unknown) => {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  for (const row of assignmentsRes.data ?? []) {
    const k = keyOf(row.created_at);
    if (!k) continue;
    (buckets[k] ??= { assignments: 0, claims: 0 }).assignments += 1;
  }
  for (const row of claimsRes.data ?? []) {
    const k = keyOf(row.claimed_at);
    if (!k) continue;
    (buckets[k] ??= { assignments: 0, claims: 0 }).claims += 1;
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));
}
