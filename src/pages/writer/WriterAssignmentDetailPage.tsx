import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlarmClock,
  ArrowLeft,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  FileText,
  Layers,
  Lock,
  MessageSquare,
  Paperclip,
  Quote,
  Send,
  Timer,
  Upload,
  Users,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  DescriptionList,
  EmptyState,
  ErrorState,
  Loading,
  Meta,
  Money,
  PageHeader,
  Timeline,
} from "../../components/common";
import { StatusBadge } from "../../components/common/StatusBadge";
import { StoredFileList, type StoredFile } from "../../components/forms/FileUpload";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import {
  claimAssignment,
  getAssignment,
  getClaimByAssignment,
  listSubmissionsForClaim,
} from "../../services";
import { formatCountdown, formatDateTime, formatRelative } from "../../utils/date";
import { formatNumber } from "../../utils/format";

export function WriterAssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [claiming, setClaiming] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    if (!id || !user) return null;
    const assignment = await getAssignment(id);
    const claim = await getClaimByAssignment(id, user.id);
    const submissions = claim ? await listSubmissionsForClaim(claim.id) : [];
    return { assignment, claim, submissions };
  }, [id, user?.id]);

  if (loading) return <Loading full label="Loading assignment…" />;
  if (error || !data) {
    return <ErrorState title="Assignment not found" description={error ?? "This assignment could not be loaded."} onRetry={reload} />;
  }

  const { assignment, claim, submissions } = data;
  const suspended = profile?.status === "suspended";
  const expired = assignment.deadline ? new Date(assignment.deadline) < new Date() : false;
  const latestSubmission = submissions[0];
  const needsRevision = latestSubmission?.status === "revision" || claim?.status === "revision";

  const handleClaim = async () => {
    setClaiming(true);
    try {
      await claimAssignment(assignment.id);
      toast.success("Assignment claimed", "You can now submit your work.");
      reload();
    } catch (err) {
      toast.error("Could not claim assignment", err instanceof Error ? err.message : undefined);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader
        title={assignment.title}
        description={assignment.assignment_code ?? "Assignment"}
        actions={
          <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate(-1)}>
            Back
          </Button>
        }
      />

      <div className="iw-inline iw-gap-3 iw-mb-5" style={{ flexWrap: "wrap" }}>
        <StatusBadge kind="assignment" value={assignment.status} />
        <StatusBadge kind="priority" value={assignment.priority} dot={false} />
        {assignment.subject?.name && <Badge tone="accent">{assignment.subject.name}</Badge>}
        {assignment.category?.name && <Badge tone="neutral">{assignment.category.name}</Badge>}
        {assignment.academic_level && <Badge tone="outline">{assignment.academic_level}</Badge>}
        <Badge tone={expired ? "danger" : "neutral"} icon={AlarmClock}>
          {formatCountdown(assignment.deadline)}
        </Badge>
      </div>

      {suspended && (
        <Alert tone="warning" title="Account suspended" className="iw-mb-5">
          You cannot claim or submit work while your account is suspended.
        </Alert>
      )}

      {needsRevision && (
        <Alert tone="warning" title="Revision requested" className="iw-mb-5" icon={MessageSquare}>
          {latestSubmission?.feedback || "The reviewer has asked for changes. Open your workspace to resubmit."}
        </Alert>
      )}

      <div className="iw-grid iw-grid--2-1">
        <div className="stack iw-gap-5">
          <Card flush>
            <CardHeader title="Brief" subtitle="What you need to produce" />
            <div className="iw-card__body stack iw-gap-5">
              {assignment.description && <p className="text-sm text-secondary">{assignment.description}</p>}
              {assignment.instructions ? (
                <div>
                  <div className="iw-field__label iw-mb-4">Instructions</div>
                  <p className="text-sm" style={{ whiteSpace: "pre-wrap" }}>
                    {assignment.instructions}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted">No detailed instructions were provided.</p>
              )}
            </div>
          </Card>

          <Card flush>
            <CardHeader title="Requirements" subtitle="Length, formatting and sources" />
            <div className="iw-card__body">
              <div className="iw-assignment__meta">
                <Meta icon={FileText} label="Words" value={assignment.words ? formatNumber(assignment.words) : "—"} />
                <Meta icon={Layers} label="Pages" value={assignment.pages ?? "—"} />
                <Meta icon={BookOpen} label="Sources" value={assignment.sources_required ?? "—"} />
                <Meta icon={Quote} label="Citation" value={assignment.citation_style ?? "—"} />
                <Meta icon={Timer} label="Duration" value={assignment.estimated_duration ?? "—"} />
                <Meta icon={Users} label="Max claims" value={assignment.max_claims ?? 1} />
              </div>
            </div>
          </Card>

          <Card flush>
            <CardHeader title="Attachments" subtitle={`${assignment.attachments?.length ?? 0} file(s) from the client`} />
            <div className="iw-card__body">
              <StoredFileList files={(assignment.attachments ?? []) as StoredFile[]} emptyLabel="No files attached to this assignment." />
            </div>
          </Card>

          {submissions.length > 0 && (
            <Card flush>
              <CardHeader title="Your submissions" subtitle={`${submissions.length} submission(s)`} />
              <div className="iw-card__body">
                <Timeline
                  items={submissions.map((submission) => ({
                    icon: submission.status === "approved" ? CheckCircle2 : Upload,
                    title: `Submitted ${formatRelative(submission.submitted_at)}`,
                    meta: (
                      <span className="iw-inline iw-gap-2">
                        <StatusBadge kind="submission" value={submission.status} dot={false} />
                        {submission.feedback ? ` · ${submission.feedback}` : ""}
                      </span>
                    ),
                    time: submission.submitted_at,
                  }))}
                />
              </div>
            </Card>
          )}
        </div>

        <div className="stack iw-gap-5">
          <Card flush>
            <CardHeader title="Reward" subtitle="Paid on approval" />
            <div className="iw-card__body stack iw-gap-4">
              <div>
                <div className="iw-reward">{assignment.reward != null ? `$${formatNumber(assignment.reward)}` : "—"}</div>
                <div className="iw-reward__label">credited to your wallet</div>
              </div>
              <div className="iw-divider" />
              <DescriptionList
                items={[
                  { label: "Deadline", value: formatDateTime(assignment.deadline) },
                  { label: "Level", value: assignment.academic_level ?? "—" },
                  { label: "Spacing", value: assignment.spacing ?? "—" },
                  { label: "File format", value: assignment.file_format ?? "—" },
                ]}
              />
            </div>
          </Card>

          <Card flush>
            <CardHeader title="Action" subtitle={claim ? "You own this assignment" : "Claim to start working"} />
            <div className="iw-card__body stack iw-gap-3">
              {claim ? (
                <>
                  <div className="iw-between">
                    <span className="text-sm text-secondary">Claim status</span>
                    <StatusBadge kind="claim" value={claim.status} />
                  </div>
                  <Button
                    variant="primary"
                    icon={claim.status === "approved" || claim.status === "rejected" ? FileText : Send}
                    block
                    onClick={() => navigate(`/writer/my-assignments/${claim.id}`)}
                  >
                    {needsRevision ? "Resubmit work" : claim.status === "claimed" ? "Submit work" : "Open workspace"}
                  </Button>
                  {claim.status === "approved" && (
                    <Badge tone="success" lg>
                      Approved — earnings credited
                    </Badge>
                  )}
                </>
              ) : (
                <>
                  {expired ? (
                    <Alert tone="danger" title="Deadline passed">
                      This assignment is no longer accepting claims.
                    </Alert>
                  ) : assignment.status === "claimed" ? (
                    <Alert tone="warning" title="Assignment not available">
                      Sorry, this assignment has already been claimed by another writer.
                    </Alert>
                  ) : assignment.status !== "available" ? (
                    <Alert tone="neutral" title="Not open for claims">
                      This assignment is currently {assignment.status}.
                    </Alert>
                  ) : (
                    <Button variant="primary" icon={Lock} block loading={claiming} disabled={suspended || assignment.status !== "available"} onClick={handleClaim}>
                      Claim assignment
                    </Button>
                  )}
                  <p className="text-xs text-muted">
                    Claiming reserves this assignment for you. Submit before the deadline to be paid.
                  </p>
                </>
              )}
            </div>
          </Card>

          <Card flush>
            <CardHeader title="What happens next" />
            <div className="iw-card__body">
              <Timeline
                items={[
                  { icon: Lock, title: "Claim the assignment", meta: "It's reserved for you", time: claim?.claimed_at ?? null },
                  { icon: Paperclip, title: "Upload your work", meta: "Attach files and add notes", time: claim?.submitted_at ?? null },
                  { icon: CheckCircle2, title: "Get approved & paid", meta: "Earnings land in your wallet", time: claim?.reviewed_at ?? null },
                ]}
              />
            </div>
          </Card>

          {!assignment.attachments?.length && (
            <EmptyState icon={Paperclip} title="No client files" description="Refer to the brief above." compact />
          )}
        </div>
      </div>

      <div className="iw-inline iw-gap-2 iw-mt-4 text-xs text-muted">
        <CalendarClock size={13} />
        <span>Due {formatDateTime(assignment.deadline)}</span>
        <Money value={assignment.reward} />
      </div>
    </div>
  );
}
