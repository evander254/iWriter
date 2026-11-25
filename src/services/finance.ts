import { supabase } from "../lib/supabase";
import { ApiError, friendlyError, pageRange, unwrapList } from "./api";
import type { ListParams, Paginated, Transaction, WithdrawalRequest, WithdrawalStatus } from "../types/models";

const TX_SELECT = `*, writer:profiles!transactions_user_id_fkey(*)`;
const WD_SELECT = `*, writer:profiles!withdrawal_requests_user_id_fkey(*)`;

export interface TransactionFilters extends ListParams {
  userId?: string;
  type?: string | string[];
}

export async function listTransactions(filters: TransactionFilters = {}): Promise<Paginated<Transaction>> {
  const { page = 1, pageSize = 12, sortBy = "created_at", sortDir = "desc" } = filters;
  const [from, to] = pageRange(page, pageSize);

  let query = supabase.from("transactions").select(TX_SELECT, { count: "exact" });
  if (filters.userId) query = query.eq("user_id", filters.userId);
  if (filters.type) {
    if (Array.isArray(filters.type)) query = query.in("transaction_type", filters.type);
    else query = query.eq("transaction_type", filters.type);
  }
  query = query.order(sortBy, { ascending: sortDir === "asc" }).range(from, to);

  const { data, error, count } = await query;
  return { rows: unwrapList(data as Transaction[] | null, error), count: count ?? 0, page, pageSize };
}

export async function listRecentTransactions(userId: string, limit = 6): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select(TX_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return unwrapList(data as Transaction[] | null, error);
}

export async function sumTransactions(userId: string): Promise<{ credits: number; debits: number }> {
  const { data, error } = await supabase.from("transactions").select("amount, transaction_type").eq("user_id", userId);
  if (error) return { credits: 0, debits: 0 };
  let credits = 0;
  let debits = 0;
  for (const row of data ?? []) {
    const amount = Number(row.amount ?? 0);
    if (amount >= 0) credits += amount;
    else debits += Math.abs(amount);
  }
  return { credits, debits };
}

/* ---------------- Withdrawals ---------------- */

export interface WithdrawalFilters extends ListParams {
  userId?: string;
  status?: WithdrawalStatus | WithdrawalStatus[];
}

export async function listWithdrawals(filters: WithdrawalFilters = {}): Promise<Paginated<WithdrawalRequest>> {
  const { page = 1, pageSize = 12, sortBy = "requested_at", sortDir = "desc" } = filters;
  const [from, to] = pageRange(page, pageSize);

  let query = supabase.from("withdrawal_requests").select(WD_SELECT, { count: "exact" });
  if (filters.userId) query = query.eq("user_id", filters.userId);
  if (filters.status) {
    if (Array.isArray(filters.status)) query = query.in("status", filters.status);
    else query = query.eq("status", filters.status);
  }
  query = query.order(sortBy, { ascending: sortDir === "asc" }).range(from, to);

  const { data, error, count } = await query;
  return { rows: unwrapList(data as WithdrawalRequest[] | null, error), count: count ?? 0, page, pageSize };
}

export async function listRecentWithdrawals(userId: string, limit = 5): Promise<WithdrawalRequest[]> {
  const { data, error } = await supabase
    .from("withdrawal_requests")
    .select(WD_SELECT)
    .eq("user_id", userId)
    .order("requested_at", { ascending: false })
    .limit(limit);
  return unwrapList(data as WithdrawalRequest[] | null, error);
}

export async function listPendingWithdrawals(limit = 6): Promise<WithdrawalRequest[]> {
  const { data, error } = await supabase
    .from("withdrawal_requests")
    .select(WD_SELECT)
    .eq("status", "pending")
    .order("requested_at", { ascending: true })
    .limit(limit);
  return unwrapList(data as WithdrawalRequest[] | null, error);
}

export interface WriterWithdrawalMethod {
  writer_id: string;
  method: string;
  account_number: string;
  last_changed_at: string;
}

export async function getWriterWithdrawalMethod(writerId: string): Promise<WriterWithdrawalMethod | null> {
  const { data, error } = await supabase
    .from("writer_withdrawal_methods")
    .select("writer_id, method, account_number, last_changed_at")
    .eq("writer_id", writerId)
    .maybeSingle();
  if (error) throw new ApiError(error.message, error);
  return data as WriterWithdrawalMethod | null;
}

export async function saveWriterWithdrawalMethod(method: string, accountNumber: string): Promise<void> {
  const { error } = await supabase.rpc("set_writer_withdrawal_method", {
    p_method: method,
    p_account_number: accountNumber,
  });
  if (error) throw new ApiError(friendlyError(error), error);
}

/** Writer: request a withdrawal using the saved payout details. */
export async function requestWithdrawal(amount: number): Promise<string> {
  const { data, error } = await supabase.rpc("request_withdrawal", { p_amount: amount });
  if (error) throw new ApiError(friendlyError(error), error);
  return String(data);
}

/** Admin: approve / reject / mark paid (atomic, no double processing). */
export async function processWithdrawal(
  requestId: string,
  action: "approved" | "rejected" | "paid",
  adminNotes: string,
): Promise<void> {
  const { error } = await supabase.rpc("process_withdrawal", {
    p_request_id: requestId,
    p_action: action,
    p_admin_notes: adminNotes || null,
  });
  if (error) throw new ApiError(friendlyError(error), error);
}

export interface FinanceSummary {
  totalEarnings: number;
  totalAvailableBalances: number;
  pendingWithdrawals: number;
  approvedWithdrawals: number;
  paidWithdrawals: number;
  rejectedWithdrawals: number;
  pendingWithdrawalCount: number;
}

export async function getFinanceSummary(): Promise<FinanceSummary> {
  const [profilesRes, withdrawalsRes] = await Promise.all([
    supabase.from("profiles").select("total_earnings, available_balance").eq("role", "writer"),
    supabase.from("withdrawal_requests").select("amount, status"),
  ]);

  let totalEarnings = 0;
  let totalAvailableBalances = 0;
  for (const row of profilesRes.data ?? []) {
    totalEarnings += Number(row.total_earnings ?? 0);
    totalAvailableBalances += Number(row.available_balance ?? 0);
  }

  const sum = { pending: 0, approved: 0, paid: 0, rejected: 0 };
  let pendingCount = 0;
  for (const row of withdrawalsRes.data ?? []) {
    const amount = Number(row.amount ?? 0);
    const status = String(row.status) as WithdrawalStatus;
    if (status in sum) sum[status] += amount;
    if (status === "pending") pendingCount += 1;
  }

  return {
    totalEarnings,
    totalAvailableBalances,
    pendingWithdrawals: sum.pending,
    approvedWithdrawals: sum.approved,
    paidWithdrawals: sum.paid,
    rejectedWithdrawals: sum.rejected,
    pendingWithdrawalCount: pendingCount,
  };
}

/** Raw earning transactions (for flexible client-side chart bucketing). */
export async function getEarningPoints(userId?: string): Promise<Array<{ created_at: string; amount: number }>> {
  let query = supabase
    .from("transactions")
    .select("amount, created_at, transaction_type")
    .eq("transaction_type", "earning");
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []).map((row) => ({ created_at: String(row.created_at), amount: Number(row.amount ?? 0) }));
}

/** Earnings grouped by month for charts. */
export async function getEarningsSeries(userId?: string): Promise<Array<{ month: string; amount: number }>> {
  let query = supabase
    .from("transactions")
    .select("amount, transaction_type, created_at")
    .eq("transaction_type", "earning")
    .order("created_at", { ascending: true });
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) return [];
  const buckets: Record<string, number> = {};
  for (const row of data ?? []) {
    const d = new Date(String(row.created_at));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets[key] = (buckets[key] ?? 0) + Number(row.amount ?? 0);
  }
  return Object.entries(buckets).map(([month, amount]) => ({ month, amount }));
}
