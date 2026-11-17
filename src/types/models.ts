import type { Profile } from "./index";

/* ------------------------------------------------------------------ */
/* Status unions — must match the CHECK constraints in Supabase        */
/* ------------------------------------------------------------------ */

export type AssignmentStatus =
  | "draft"
  | "available"
  | "claimed"
  | "pending_review"
  | "revision"
  | "approved"
  | "completed"
  | "cancelled"
  | "expired";

export type AssignmentPriority = "low" | "normal" | "high" | "urgent";

export type ClaimStatus = "claimed" | "submitted" | "revision" | "approved" | "rejected";

export type SubmissionStatus = "pending" | "approved" | "rejected" | "revision";

export type RevisionStatus = "pending" | "resolved" | "cancelled";

export type TransactionType = "earning" | "withdrawal" | "bonus" | "penalty" | "adjustment";

export type WithdrawalStatus = "pending" | "approved" | "paid" | "rejected";

export type Visibility = "public" | "private";

/* ------------------------------------------------------------------ */
/* Entities (1:1 with the live tables)                                 */
/* ------------------------------------------------------------------ */

export interface Subject {
  id: string;
  name: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

/** `assignment_attachments` */
export interface AssignmentAttachment {
  id: string;
  assignment_id: string | null;
  file_name: string | null;
  file_url: string | null;
  uploaded_at: string;
}

/** `assignments` */
export interface Assignment {
  id: string;
  assignment_code: string | null;
  title: string;
  description: string | null;
  instructions: string | null;
  subject_id: string | null;
  category_id: string | null;
  academic_level: string | null;
  citation_style: string | null;
  pages: number | null;
  words: number | null;
  spacing: string | null;
  sources_required: number | null;
  file_format: string | null;
  estimated_duration: string | null;
  reward: number | null;
  priority: AssignmentPriority;
  deadline: string | null;
  max_claims: number;
  status: AssignmentStatus;
  visibility: Visibility | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  /* joins */
  subject?: Subject | null;
  category?: Category | null;
  attachments?: AssignmentAttachment[];
}

/** `assignment_claims` */
export interface AssignmentClaim {
  id: string;
  assignment_id: string | null;
  writer_id: string | null;
  status: ClaimStatus;
  claimed_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  /* joins */
  assignment?: Assignment | null;
  writer?: Profile | null;
}

/** `submissions` */
export interface Submission {
  id: string;
  claim_id: string | null;
  notes: string | null;
  status: SubmissionStatus;
  feedback: string | null;
  submitted_at: string;
  updated_at: string | null;
  /* joins */
  files?: SubmissionFile[];
  claim?: AssignmentClaim | null;
  revision_requests?: RevisionRequest[];
}

/** `submission_files` */
export interface SubmissionFile {
  id: string;
  submission_id: string | null;
  file_name: string | null;
  file_url: string | null;
  uploaded_at: string;
}

/** `revision_requests` */
export interface RevisionRequest {
  id: string;
  submission_id: string | null;
  feedback: string | null;
  status: RevisionStatus;
  created_at: string;
  /* joins */
  submission?: Submission | null;
}

/** `transactions` — `amount` is signed: credits positive, debits negative. */
export interface Transaction {
  id: string;
  user_id: string | null;
  amount: number | null;
  transaction_type: string | null;
  description: string | null;
  reference: string | null;
  created_at: string;
  /* joins */
  writer?: Profile | null;
}

/** `withdrawal_requests` */
export interface WithdrawalRequest {
  id: string;
  user_id: string | null;
  amount: number | null;
  method: string | null;
  account_number: string | null;
  status: WithdrawalStatus;
  admin_notes: string | null;
  requested_at: string;
  processed_at: string | null;
  /* joins */
  writer?: Profile | null;
}

/** `notifications` */
export interface AppNotification {
  id: string;
  user_id: string | null;
  title: string | null;
  message: string | null;
  type: string | null;
  is_read: boolean;
  created_at: string;
}

/** `announcements` */
export interface Announcement {
  id: string;
  title: string | null;
  message: string | null;
  is_active: boolean;
  created_at: string;
}

/** `assignment_history` */
export interface AssignmentHistoryEntry {
  id: string;
  assignment_id: string | null;
  user_id: string | null;
  old_status: string | null;
  new_status: string | null;
  remarks: string | null;
  created_at: string;
  /* joins */
  actor?: Profile | null;
  assignment?: Assignment | null;
}

/** `activity_logs` */
export interface ActivityLogEntry {
  id: string;
  user_id: string | null;
  activity: string | null;
  ip_address: string | null;
  created_at: string;
  /* joins */
  actor?: Profile | null;
}

/** `settings` */
export interface Setting {
  id: string;
  setting_key: string | null;
  setting_value: string | null;
  description: string | null;
  updated_at: string | null;
}

/* ------------------------------------------------------------------ */
/* Query helpers                                                       */
/* ------------------------------------------------------------------ */

export interface Paginated<T> {
  rows: T[];
  count: number;
  page: number;
  pageSize: number;
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface AdminStats {
  totalWriters: number;
  activeWriters: number;
  suspendedWriters: number;
  totalAssignments: number;
  availableAssignments: number;
  claimedAssignments: number;
  pendingSubmissions: number;
  pendingRevisions: number;
  completedAssignments: number;
  totalWriterEarnings: number;
  totalWithdrawals: number;
  pendingWithdrawals: number;
}

export interface WriterStats {
  availableBalance: number;
  totalEarnings: number;
  totalWithdrawn: number;
  activeAssignments: number;
  completedAssignments: number;
  pendingSubmissions: number;
  revisionRequests: number;
  availableAssignments: number;
}
