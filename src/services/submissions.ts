import { supabase } from "../lib/supabase";
import { ApiError, friendlyError, pageRange, unwrap, unwrapList } from "./api";
import type { ListParams, Paginated, RevisionRequest, Submission, SubmissionStatus } from "../types/models";

const SUBMISSION_SELECT = `
  *,
  files:submission_files(*),
  claim:assignment_claims!submissions_claim_id_fkey(
    *,
    assignment:assignments(*, subject:subjects(*), category:categories(*)),
    writer:profiles!assignment_claims_writer_id_fkey(*)
  ),
  revision_requests(*)
`;

const SUBMISSION_SELECT_INNER = `
  *,
  files:submission_files(*),
  claim:assignment_claims!submissions_claim_id_fkey!inner(
    *,
    assignment:assignments(*, subject:subjects(*), category:categories(*)),
    writer:profiles!assignment_claims_writer_id_fkey(*)
  ),
  revision_requests(*)
`;

export interface SubmissionFilters extends ListParams {
  status?: SubmissionStatus | SubmissionStatus[];
  writerId?: string;
  assignmentId?: string;
  claimId?: string;
}

/** Submissions for a specific writer (filters through the claim join). */
export async function listWriterSubmissions(
  writerId: string,
  filters: SubmissionFilters = {},
): Promise<Paginated<Submission>> {
  const { page = 1, pageSize = 10, sortBy = "submitted_at", sortDir = "desc" } = filters;
  const [from, to] = pageRange(page, pageSize);

  let query = supabase
    .from("submissions")
    .select(SUBMISSION_SELECT_INNER, { count: "exact" })
    .eq("claim.writer_id", writerId);

  if (filters.status) {
    if (Array.isArray(filters.status)) query = query.in("status", filters.status);
    else query = query.eq("status", filters.status);
  }
  if (filters.claimId) query = query.eq("claim_id", filters.claimId);

  query = query.order(sortBy, { ascending: sortDir === "asc" }).range(from, to);
  const { data, error, count } = await query;
  return { rows: unwrapList(data as Submission[] | null, error), count: count ?? 0, page, pageSize };
}

/** All submissions (admin). */
export async function listAllSubmissions(filters: SubmissionFilters = {}): Promise<Paginated<Submission>> {
  const { page = 1, pageSize = 12, sortBy = "submitted_at", sortDir = "desc" } = filters;
  const [from, to] = pageRange(page, pageSize);

  let query = supabase.from("submissions").select(SUBMISSION_SELECT, { count: "exact" });

  if (filters.status) {
    if (Array.isArray(filters.status)) query = query.in("status", filters.status);
    else query = query.eq("status", filters.status);
  }
  if (filters.claimId) query = query.eq("claim_id", filters.claimId);

  query = query.order(sortBy, { ascending: sortDir === "asc" }).range(from, to);
  const { data, error, count } = await query;
  return { rows: unwrapList(data as Submission[] | null, error), count: count ?? 0, page, pageSize };
}

export async function getSubmission(id: string): Promise<Submission> {
  const { data, error } = await supabase.from("submissions").select(SUBMISSION_SELECT).eq("id", id).single();
  return unwrap(data as Submission | null, error, "submission");
}

export async function listSubmissionsForClaim(claimId: string): Promise<Submission[]> {
  const { data, error } = await supabase
    .from("submissions")
    .select(SUBMISSION_SELECT)
    .eq("claim_id", claimId)
    .order("submitted_at", { ascending: false });
  return unwrapList(data as Submission[] | null, error);
}

export interface SubmissionFileInput {
  file_name: string;
  file_url: string;
}

/** Atomic submission via RPC. */
export async function submitWork(
  claimId: string,
  notes: string,
  files: SubmissionFileInput[],
): Promise<string> {
  const { data, error } = await supabase.rpc("submit_work", {
    p_claim_id: claimId,
    p_notes: notes,
    p_files: files,
  });
  if (error) throw new ApiError(friendlyError(error), error);
  return String(data);
}

export type ReviewDecision = "approved" | "rejected" | "revision";

/** Admin review via RPC (approve credits earnings exactly once). */
export async function reviewSubmission(
  submissionId: string,
  decision: ReviewDecision,
  feedback: string,
): Promise<void> {
  const { error } = await supabase.rpc("review_submission", {
    p_submission_id: submissionId,
    p_decision: decision,
    p_feedback: feedback || null,
  });
  if (error) throw new ApiError(friendlyError(error), error);
}

/* ---------------- Revision requests ---------------- */

export async function listRevisionRequestsForWriter(writerId: string): Promise<RevisionRequest[]> {
  const { data: claims } = await supabase.from("assignment_claims").select("id").eq("writer_id", writerId);
  const claimIds = (claims ?? []).map((c) => c.id);
  if (claimIds.length === 0) return [];

  const { data: submissions } = await supabase.from("submissions").select("id").in("claim_id", claimIds);
  const submissionIds = (submissions ?? []).map((s) => s.id);
  if (submissionIds.length === 0) return [];

  const { data, error } = await supabase
    .from("revision_requests")
    .select("*, submission:submissions(*, claim:assignment_claims!submissions_claim_id_fkey(*, assignment:assignments(*)))")
    .in("submission_id", submissionIds)
    .order("created_at", { ascending: false });
  return unwrapList(data as RevisionRequest[] | null, error);
}

export async function listAllRevisionRequests(): Promise<RevisionRequest[]> {
  const { data, error } = await supabase
    .from("revision_requests")
    .select(
      "*, submission:submissions(*, claim:assignment_claims!submissions_claim_id_fkey(*, assignment:assignments(*), writer:profiles!assignment_claims_writer_id_fkey(*)))",
    )
    .order("created_at", { ascending: false });
  return unwrapList(data as RevisionRequest[] | null, error);
}

export async function countSubmissionsByStatus(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("submissions").select("status");
  const counts: Record<string, number> = {};
  if (error) return counts;
  for (const row of data ?? []) {
    const s = String(row.status ?? "pending");
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts;
}
