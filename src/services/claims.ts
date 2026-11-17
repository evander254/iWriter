import { supabase } from "../lib/supabase";
import { ApiError, friendlyError, pageRange, sanitizeSearch, unwrap, unwrapList } from "./api";
import type { AssignmentClaim, ClaimStatus, ListParams, Paginated } from "../types/models";

const CLAIM_SELECT = `
  *,
  assignment:assignments(*, subject:subjects(*), category:categories(*)),
  writer:profiles!assignment_claims_writer_id_fkey(*)
`;

export interface ClaimFilters extends ListParams {
  status?: ClaimStatus | ClaimStatus[];
  writerId?: string;
  assignmentId?: string;
}

/** Claims belonging to a specific writer. */
export async function listWriterClaims(
  writerId: string,
  filters: ClaimFilters = {},
): Promise<Paginated<AssignmentClaim>> {
  const { page = 1, pageSize = 10, search, sortBy = "claimed_at", sortDir = "desc" } = filters;
  const [from, to] = pageRange(page, pageSize);

  let query = supabase
    .from("assignment_claims")
    .select(CLAIM_SELECT, { count: "exact" })
    .eq("writer_id", writerId);

  if (filters.status) {
    if (Array.isArray(filters.status)) query = query.in("status", filters.status);
    else query = query.eq("status", filters.status);
  }
  if (filters.assignmentId) query = query.eq("assignment_id", filters.assignmentId);

  if (search) {
    const term = sanitizeSearch(search);
    if (term) query = query.or(`assignment.title.ilike.%${term}%,assignment.assignment_code.ilike.%${term}%`);
  }

  query = query.order(sortBy, { ascending: sortDir === "asc" }).range(from, to);
  const { data, error, count } = await query;
  return { rows: unwrapList(data as AssignmentClaim[] | null, error), count: count ?? 0, page, pageSize };
}

/** All claims (admin view). */
export async function listAllClaims(filters: ClaimFilters = {}): Promise<Paginated<AssignmentClaim>> {
  const { page = 1, pageSize = 12, search, sortBy = "claimed_at", sortDir = "desc" } = filters;
  const [from, to] = pageRange(page, pageSize);

  let query = supabase.from("assignment_claims").select(CLAIM_SELECT, { count: "exact" });

  if (filters.status) {
    if (Array.isArray(filters.status)) query = query.in("status", filters.status);
    else query = query.eq("status", filters.status);
  }
  if (filters.writerId) query = query.eq("writer_id", filters.writerId);
  if (filters.assignmentId) query = query.eq("assignment_id", filters.assignmentId);

  if (search) {
    const term = sanitizeSearch(search);
    if (term) query = query.or(`assignment.title.ilike.%${term}%,assignment.assignment_code.ilike.%${term}%`);
  }

  query = query.order(sortBy, { ascending: sortDir === "asc" }).range(from, to);
  const { data, error, count } = await query;
  return { rows: unwrapList(data as AssignmentClaim[] | null, error), count: count ?? 0, page, pageSize };
}

export async function getClaim(id: string): Promise<AssignmentClaim> {
  const { data, error } = await supabase.from("assignment_claims").select(CLAIM_SELECT).eq("id", id).single();
  return unwrap(data as AssignmentClaim | null, error, "claim");
}

export async function getClaimByAssignment(assignmentId: string, writerId: string): Promise<AssignmentClaim | null> {
  const { data, error } = await supabase
    .from("assignment_claims")
    .select(CLAIM_SELECT)
    .eq("assignment_id", assignmentId)
    .eq("writer_id", writerId)
    .maybeSingle();
  if (error) return null;
  return (data as AssignmentClaim) ?? null;
}

/** Atomic claim via the secure RPC. */
export async function claimAssignment(assignmentId: string): Promise<string> {
  const { data, error } = await supabase.rpc("claim_assignment", { p_assignment_id: assignmentId });
  if (error) throw new ApiError(friendlyError(error), error);
  return String(data);
}

export async function countWriterClaimsByStatus(writerId: string): Promise<Record<ClaimStatus, number>> {
  const { data, error } = await supabase.from("assignment_claims").select("status").eq("writer_id", writerId);
  const base: Record<ClaimStatus, number> = {
    claimed: 0,
    submitted: 0,
    revision: 0,
    approved: 0,
    rejected: 0,
  };
  if (error) return base;
  for (const row of data ?? []) {
    const s = row.status as ClaimStatus;
    if (s in base) base[s] += 1;
  }
  return base;
}
