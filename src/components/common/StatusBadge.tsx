import { Badge, type BadgeTone } from "./Badge";
import {
  accountStatusMeta,
  assignmentStatusMeta,
  claimStatusMeta,
  priorityMeta,
  submissionStatusMeta,
  withdrawalStatusMeta,
} from "../../lib/status";

type Kind = "assignment" | "claim" | "submission" | "withdrawal" | "account" | "priority";

const RESOLVERS: Record<Kind, (value: string | null | undefined) => { label: string; tone: BadgeTone }> = {
  assignment: assignmentStatusMeta,
  claim: claimStatusMeta,
  submission: submissionStatusMeta,
  withdrawal: withdrawalStatusMeta,
  account: accountStatusMeta,
  priority: priorityMeta,
};

export function StatusBadge({ kind, value, dot = true }: { kind: Kind; value: string | null | undefined; dot?: boolean }) {
  const meta = RESOLVERS[kind](value);
  return (
    <Badge tone={meta.tone} dot={dot}>
      {meta.label}
    </Badge>
  );
}
