import type { ReactNode } from "react";
import {
  AlarmClock,
  BookOpen,
  FileText,
  GraduationCap,
  Layers,
  Quote,
  Timer,
  Users,
  Wallet,
} from "lucide-react";
import { Badge, Button, Meta } from "../common";
import { StatusBadge } from "../common/StatusBadge";
import { formatCountdown, formatDate, deadlineUrgency } from "../../utils/date";
import { formatNumber } from "../../utils/format";
import type { Assignment } from "../../types/models";

export interface AssignmentCardProps {
  assignment: Assignment;
  claimedCount?: number;
  claimId?: string | null;
  onView?: () => void;
  onClaim?: () => void;
  claiming?: boolean;
  claimDisabled?: boolean;
  footerExtra?: ReactNode;
  actions?: ReactNode;
}

const URGENCY_TONE: Record<string, "neutral" | "warning" | "danger" | "success"> = {
  overdue: "danger",
  critical: "danger",
  soon: "warning",
  normal: "neutral",
  none: "neutral",
};

export function AssignmentCard({
  assignment,
  claimedCount,
  claimId,
  onView,
  onClaim,
  claiming,
  claimDisabled = false,
  footerExtra,
  actions,
}: AssignmentCardProps) {
  const urgency = deadlineUrgency(assignment.deadline);
  const capacityReached =
    claimedCount !== undefined && claimedCount >= (assignment.max_claims ?? 1);
  const canClaim = assignment.status === "available";
  const alreadyClaimed = Boolean(claimId);

  return (
    <article className="iw-assignment">
      <header className="iw-assignment__head">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="iw-assignment__code">{assignment.assignment_code ?? "—"}</div>
          <h3 className="iw-assignment__title clamp-2">{assignment.title}</h3>
        </div>
        <StatusBadge kind="assignment" value={assignment.status} />
      </header>

      <div className="iw-assignment__tags">
        {assignment.subject?.name && <Badge tone="accent">{assignment.subject.name}</Badge>}
        {assignment.category?.name && <Badge tone="neutral">{assignment.category.name}</Badge>}
        {assignment.academic_level && <Badge tone="outline">{assignment.academic_level}</Badge>}
        <StatusBadge kind="priority" value={assignment.priority} dot={false} />
      </div>

      {assignment.description && (
        <p className="text-sm text-secondary clamp-2">{assignment.description}</p>
      )}

      <div className="iw-assignment__meta">
        <Meta icon={FileText} label="Words" value={assignment.words ? formatNumber(assignment.words) : "—"} />
        <Meta icon={Layers} label="Pages" value={assignment.pages ?? "—"} />
        <Meta icon={Quote} label="Citation" value={assignment.citation_style ?? "—"} />
        <Meta icon={BookOpen} label="Sources" value={assignment.sources_required ?? "—"} />
        <Meta icon={Timer} label="Duration" value={assignment.estimated_duration ?? "—"} />
        <Meta icon={Users} label="Claims" value={`${claimedCount ?? 0}/${assignment.max_claims ?? 1}`} />
      </div>

      <div className="iw-inline iw-gap-3">
        <Badge tone={URGENCY_TONE[urgency]} dot>
          <AlarmClock size={12} strokeWidth={2.3} />
          {formatCountdown(assignment.deadline)}
        </Badge>
        <span className="text-xs text-muted">Due {formatDate(assignment.deadline)}</span>
      </div>

      <footer className="iw-assignment__foot">
        <div>
          <div className="iw-reward">{assignment.reward != null ? `$${formatNumber(assignment.reward)}` : "—"}</div>
          <div className="iw-reward__label">Reward</div>
        </div>
        <div className="spacer" />
        {actions}
        {onView && (
          <Button size="sm" variant="ghost" icon={GraduationCap} onClick={onView}>
            Details
          </Button>
        )}
        {onClaim && !alreadyClaimed && (
          <Button
            size="sm"
            variant="primary"
            icon={Wallet}
            onClick={onClaim}
            loading={claiming}
            disabled={!canClaim || capacityReached || claimDisabled}
          >
            {capacityReached ? "Full" : claimDisabled ? "Limit reached" : "Claim"}
          </Button>
        )}
        {alreadyClaimed && (
          <Badge tone="success" lg>
            Claimed
          </Badge>
        )}
        {footerExtra}
      </footer>
    </article>
  );
}

export function AssignmentCardSkeleton() {
  return (
    <div className="iw-assignment">
      <div className="iw-skeleton" style={{ height: 14, width: "35%" }} />
      <div className="iw-skeleton" style={{ height: 22, width: "85%" }} />
      <div className="iw-skeleton" style={{ height: 14, width: "60%" }} />
      <div className="iw-skeleton" style={{ height: 90, borderRadius: 12 }} />
    </div>
  );
}
