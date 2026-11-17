import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, FileClock, MessageSquare, Send } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Chip,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
} from "../../components/common";
import { StatusBadge } from "../../components/common/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../contexts/AuthContext";
import { listRevisionRequestsForWriter } from "../../services";
import { formatDateTime, formatRelative } from "../../utils/date";

export function WriterRevisionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const { data, loading, error, reload } = useAsync(
    async () => (user ? listRevisionRequestsForWriter(user.id) : []),
    [user?.id],
  );

  const rows = (data ?? []).filter((r) => (filter === "pending" ? r.status === "pending" : true));

  return (
    <div className="animate-fade">
      <PageHeader
        title="Revision requests"
        description="Feedback from reviewers on your submissions. Address each point and resubmit."
      />

      <div className="iw-inline iw-gap-2 iw-mb-5">
        <Chip active={filter === "pending"} count={(data ?? []).filter((r) => r.status === "pending").length} onClick={() => setFilter("pending")}>
          Needs action
        </Chip>
        <Chip active={filter === "all"} count={data?.length ?? 0} onClick={() => setFilter("all")}>
          All revisions
        </Chip>
        <div className="spacer" />
        <Button variant="ghost" size="sm" icon={FileClock} onClick={reload}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <Loading label="Loading revisions…" />
      ) : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={CheckCircle2}
            title={filter === "pending" ? "No revisions to action" : "No revision requests"}
            description={
              filter === "pending"
                ? "Nice work — nothing needs a rewrite right now."
                : "When a reviewer requests changes, they'll show up here."
            }
          />
        </Card>
      ) : (
        <div className="stack iw-gap-4">
          {rows.map((revision) => {
            const submission = revision.submission;
            const assignment = submission?.claim?.assignment;
            const canResubmit = revision.status === "pending" && submission?.claim_id;
            return (
              <Card key={revision.id} flush>
                <CardHeader
                  title={assignment?.title ?? "Submission"}
                  subtitle={assignment?.assignment_code ?? ""}
                  icon={FileClock}
                  actions={
                    <Badge tone={revision.status === "pending" ? "warning" : "success"} dot>
                      {revision.status === "pending" ? "Needs action" : "Resolved"}
                    </Badge>
                  }
                />
                <div className="iw-card__body stack iw-gap-4">
                  <div className="iw-quote">
                    <MessageSquare size={15} />
                    <div>
                      <div className="iw-field__label iw-mb-4">Reviewer feedback</div>
                      <p className="text-sm">{revision.feedback || "No specific feedback provided."}</p>
                    </div>
                  </div>

                  <div className="iw-inline iw-gap-4 text-xs text-muted">
                    <span>Requested {formatRelative(revision.created_at)}</span>
                    {submission?.submitted_at && <span>Originally submitted {formatDateTime(submission.submitted_at)}</span>}
                    {submission && <StatusBadge kind="submission" value={submission.status} dot={false} />}
                  </div>

                  <div className="iw-inline iw-gap-3">
                    {canResubmit && (
                      <Button
                        variant="primary"
                        icon={Send}
                        onClick={() => navigate(`/writer/my-assignments/${submission.claim_id}`)}
                      >
                        Resubmit work
                      </Button>
                    )}
                    {assignment && (
                      <Button variant="outline" onClick={() => navigate(`/writer/assignments/${assignment.id}`)}>
                        View brief
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
