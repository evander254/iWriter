import type { BadgeTone } from "../components/common";
import type {
  AssignmentPriority,
  AssignmentStatus,
  ClaimStatus,
  SubmissionStatus,
  WithdrawalStatus,
} from "../types/models";
import type { AccountStatus } from "../types";

interface StatusMeta {
  label: string;
  tone: BadgeTone;
}

export const ASSIGNMENT_STATUS_META: Record<AssignmentStatus, StatusMeta> = {
  draft: { label: "Draft", tone: "neutral" },
  available: { label: "Available", tone: "success" },
  claimed: { label: "Claimed", tone: "info" },
  pending_review: { label: "Pending Review", tone: "warning" },
  revision: { label: "Revision", tone: "warning" },
  approved: { label: "Approved", tone: "accent" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
  expired: { label: "Expired", tone: "neutral" },
};

export const CLAIM_STATUS_META: Record<ClaimStatus, StatusMeta> = {
  claimed: { label: "In Progress", tone: "info" },
  submitted: { label: "Submitted", tone: "warning" },
  revision: { label: "Revision Requested", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};

export const SUBMISSION_STATUS_META: Record<SubmissionStatus, StatusMeta> = {
  pending: { label: "Pending Review", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  revision: { label: "Revision Requested", tone: "warning" },
};

export const WITHDRAWAL_STATUS_META: Record<WithdrawalStatus, StatusMeta> = {
  pending: { label: "Pending", tone: "warning" },
  approved: { label: "Approved", tone: "info" },
  paid: { label: "Paid", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};

export const ACCOUNT_STATUS_META: Record<AccountStatus, StatusMeta> = {
  active: { label: "Active", tone: "success" },
  suspended: { label: "Suspended", tone: "danger" },
  inactive: { label: "Inactive", tone: "neutral" },
};

export const PRIORITY_META: Record<AssignmentPriority, StatusMeta> = {
  low: { label: "Low", tone: "neutral" },
  normal: { label: "Normal", tone: "info" },
  high: { label: "High", tone: "warning" },
  urgent: { label: "Urgent", tone: "danger" },
};

export function assignmentStatusMeta(status: string | null | undefined): StatusMeta {
  return ASSIGNMENT_STATUS_META[(status ?? "available") as AssignmentStatus] ?? { label: status ?? "—", tone: "neutral" };
}

export function claimStatusMeta(status: string | null | undefined): StatusMeta {
  return CLAIM_STATUS_META[(status ?? "claimed") as ClaimStatus] ?? { label: status ?? "—", tone: "neutral" };
}

export function submissionStatusMeta(status: string | null | undefined): StatusMeta {
  return SUBMISSION_STATUS_META[(status ?? "pending") as SubmissionStatus] ?? { label: status ?? "—", tone: "neutral" };
}

export function withdrawalStatusMeta(status: string | null | undefined): StatusMeta {
  return WITHDRAWAL_STATUS_META[(status ?? "pending") as WithdrawalStatus] ?? { label: status ?? "—", tone: "neutral" };
}

export function accountStatusMeta(status: string | null | undefined): StatusMeta {
  return ACCOUNT_STATUS_META[(status ?? "active") as AccountStatus] ?? { label: status ?? "—", tone: "neutral" };
}

export function priorityMeta(priority: string | null | undefined): StatusMeta {
  return PRIORITY_META[(priority ?? "normal") as AssignmentPriority] ?? { label: priority ?? "—", tone: "neutral" };
}

/* ---------------- Static option lists for forms ---------------- */

export const ACADEMIC_LEVELS = [
  "High School",
  "College",
  "Undergraduate",
  "Bachelor's",
  "Master's",
  "PhD",
  "Professional",
] as const;

export const CITATION_STYLES = ["APA", "MLA", "Chicago", "Harvard", "IEEE", "Vancouver", "OSCOLA", "Other"] as const;

export const SPACING_OPTIONS = ["Single", "1.15", "1.5", "Double"] as const;

export const FILE_FORMATS = ["DOCX", "PDF", "PPTX", "XLSX", "TXT", "RTF", "Any"] as const;

export const DURATION_OPTIONS = [
  "1 hour",
  "2 hours",
  "3 hours",
  "6 hours",
  "12 hours",
  "1 day",
  "2 days",
  "3 days",
  "1 week",
  "2 weeks",
] as const;

export const WITHDRAWAL_METHODS = ["Bank Transfer", "PayPal", "Payoneer", "Wise", "Mobile Money", "Crypto (USDT)"] as const;

export const PRIORITY_OPTIONS: AssignmentPriority[] = ["low", "normal", "high", "urgent"];

export const ASSIGNMENT_STATUS_OPTIONS: AssignmentStatus[] = [
  "draft",
  "available",
  "claimed",
  "pending_review",
  "revision",
  "approved",
  "completed",
  "cancelled",
  "expired",
];
