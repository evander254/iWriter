import { supabase } from "../lib/supabase";
import { pageRange, sanitizeSearch, unwrap, unwrapList, generateAssignmentCode } from "./api";
import type {
  Assignment,
  AssignmentAttachment,
  AssignmentPriority,
  AssignmentStatus,
  ListParams,
  Paginated,
} from "../types/models";

const ASSIGNMENT_SELECT = `
  *,
  subject:subjects(*),
  category:categories(*),
  attachments:assignment_attachments(*)
`;

export interface AssignmentFilters extends ListParams {
  status?: AssignmentStatus | AssignmentStatus[];
  subjectId?: string;
  categoryId?: string;
  priority?: AssignmentPriority;
  academicLevel?: string;
  visibility?: string;
  minReward?: number;
  maxReward?: number;
  deadlineBefore?: string;
  deadlineAfter?: string;
  /** Only assignments whose deadline is in the future. */
  openOnly?: boolean;
  createdBy?: string;
}

/** Admin listing: everything, with full filtering. */
export async function listAssignments(filters: AssignmentFilters = {}): Promise<Paginated<Assignment>> {
  const { page = 1, pageSize = 10, search, sortBy = "created_at", sortDir = "desc" } = filters;
  const [from, to] = pageRange(page, pageSize);

  let query = supabase.from("assignments").select(ASSIGNMENT_SELECT, { count: "exact" });

  if (filters.status) {
    if (Array.isArray(filters.status)) query = query.in("status", filters.status);
    else query = query.eq("status", filters.status);
  }
  if (filters.subjectId) query = query.eq("subject_id", filters.subjectId);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.academicLevel) query = query.eq("academic_level", filters.academicLevel);
  if (filters.visibility) query = query.eq("visibility", filters.visibility);
  if (filters.createdBy) query = query.eq("created_by", filters.createdBy);
  if (typeof filters.minReward === "number") query = query.gte("reward", filters.minReward);
  if (typeof filters.maxReward === "number") query = query.lte("reward", filters.maxReward);
  if (filters.deadlineBefore) query = query.lte("deadline", filters.deadlineBefore);
  if (filters.deadlineAfter) query = query.gte("deadline", filters.deadlineAfter);
  if (filters.openOnly) query = query.gte("deadline", new Date().toISOString());

  if (search) {
    const term = sanitizeSearch(search);
    if (term) {
      query = query.or(
        `title.ilike.%${term}%,assignment_code.ilike.%${term}%,description.ilike.%${term}%`,
      );
    }
  }

  query = query.order(sortBy, { ascending: sortDir === "asc" }).range(from, to);

  const { data, error, count } = await query;
  return {
    rows: unwrapList(data as Assignment[] | null, error),
    count: count ?? 0,
    page,
    pageSize,
  };
}

/** Writer marketplace: only public assignments that have not been claimed. */
export async function listMarketplaceAssignments(filters: AssignmentFilters = {}): Promise<Paginated<Assignment>> {
  const {
    page = 1,
    pageSize = 9,
    search,
    sortBy = "created_at",
    sortDir = "desc",
  } = filters;
  const [from, to] = pageRange(page, pageSize);

  let query = supabase
    .from("assignments")
    .select(ASSIGNMENT_SELECT, { count: "exact" })
    .eq("visibility", "public")
    .eq("status", "available")
    .gte("deadline", new Date().toISOString());

  if (filters.subjectId) query = query.eq("subject_id", filters.subjectId);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.academicLevel) query = query.eq("academic_level", filters.academicLevel);
  if (typeof filters.minReward === "number") query = query.gte("reward", filters.minReward);
  if (typeof filters.maxReward === "number") query = query.lte("reward", filters.maxReward);

  if (search) {
    const term = sanitizeSearch(search);
    if (term) {
      query = query.or(
        `title.ilike.%${term}%,assignment_code.ilike.%${term}%,description.ilike.%${term}%`,
      );
    }
  }

  query = query.order(sortBy, { ascending: sortDir === "asc" }).range(from, to);

  const { data, error, count } = await query;
  return {
    rows: unwrapList(data as Assignment[] | null, error),
    count: count ?? 0,
    page,
    pageSize,
  };
}

export async function getAssignment(id: string): Promise<Assignment> {
  const { data, error } = await supabase.from("assignments").select(ASSIGNMENT_SELECT).eq("id", id).single();
  return unwrap(data as Assignment | null, error, "assignment");
}

export type AssignmentInput = {
  title: string;
  description?: string | null;
  instructions?: string | null;
  subject_id?: string | null;
  category_id?: string | null;
  academic_level?: string | null;
  citation_style?: string | null;
  pages?: number | null;
  words?: number | null;
  spacing?: string | null;
  sources_required?: number | null;
  file_format?: string | null;
  estimated_duration?: string | null;
  reward?: number | null;
  priority?: AssignmentPriority;
  deadline?: string | null;
  max_claims?: number;
  status?: AssignmentStatus;
  visibility?: string;
  assignment_code?: string | null;
};

export async function createAssignment(input: AssignmentInput, createdBy: string): Promise<Assignment> {
  const payload = {
    ...input,
    assignment_code: input.assignment_code?.trim() || generateAssignmentCode(),
    created_by: createdBy,
    status: input.status ?? "draft",
    visibility: input.visibility ?? "public",
    priority: input.priority ?? "normal",
    max_claims: input.max_claims ?? 1,
  };
  const { data, error } = await supabase.from("assignments").insert(payload).select(ASSIGNMENT_SELECT).single();
  return unwrap(data as Assignment | null, error, "assignment");
}

export async function updateAssignment(id: string, input: Partial<AssignmentInput>): Promise<Assignment> {
  const { data, error } = await supabase
    .from("assignments")
    .update(input)
    .eq("id", id)
    .select(ASSIGNMENT_SELECT)
    .single();
  return unwrap(data as Assignment | null, error, "assignment");
}

export async function setAssignmentStatus(id: string, status: AssignmentStatus): Promise<Assignment> {
  return updateAssignment(id, { status });
}

export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await supabase.from("assignments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------------- Attachments ---------------- */

export async function listAssignmentAttachments(assignmentId: string): Promise<AssignmentAttachment[]> {
  const { data, error } = await supabase
    .from("assignment_attachments")
    .select("*")
    .eq("assignment_id", assignmentId)
    .order("uploaded_at", { ascending: true });
  return unwrapList(data as AssignmentAttachment[] | null, error);
}

export async function addAssignmentAttachment(input: {
  assignment_id: string;
  file_name: string;
  file_url: string;
}): Promise<AssignmentAttachment> {
  const { data, error } = await supabase.from("assignment_attachments").insert(input).select("*").single();
  return unwrap(data as AssignmentAttachment | null, error, "attachment");
}

export async function deleteAssignmentAttachment(id: string): Promise<void> {
  const { error } = await supabase.from("assignment_attachments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------------- Derived helpers ---------------- */

/** Count non-rejected claims per assignment id. */
export async function getClaimCounts(assignmentIds: string[]): Promise<Record<string, number>> {
  if (assignmentIds.length === 0) return {};
  const { data, error } = await supabase
    .from("assignment_claims")
    .select("assignment_id, status")
    .in("assignment_id", assignmentIds);
  if (error) return {};
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    if (row.status === "rejected") continue;
    const key = String(row.assignment_id);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** The current user's claims, mapped by assignment id. */
export async function getMyClaimMap(writerId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("assignment_claims")
    .select("id, assignment_id, status")
    .eq("writer_id", writerId);
  if (error) return {};
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.status === "rejected") continue;
    if (row.assignment_id) map[String(row.assignment_id)] = String(row.id);
  }
  return map;
}

export async function listAssignmentHistory(assignmentId: string) {
  const { data, error } = await supabase
    .from("assignment_history")
    .select("*, actor:profiles!assignment_history_user_id_fkey(*)")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: false });
  return unwrapList(data, error);
}
