import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Layers,
  MessageSquare,
  Quote,
  RefreshCcw,
  ShieldCheck,
  Timer,
  Users,
  XCircle,
} from "lucide-react";
import {
  Alert,
  Avatar,
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
  Textarea,
  Timeline,
} from "../../components/common";
import { StatusBadge } from "../../components/common/StatusBadge";
import { StoredFileList, type StoredFile } from "../../components/forms/FileUpload";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../contexts/ToastContext";
import { getSubmission, listSubmissionsForClaim, reviewSubmission, type ReviewDecision } from "../../services";
import { displayName } from "../../types";
import { formatDate, formatDateTime, formatRelative } from "../../utils/date";
import { formatNumber } from "../../utils/format";

export function AdminSubmissionReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [feedback, setFeedback] = useState("");
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    if (!id) return null;
    const submission = await getSubmission(id);
    const history = submission.claim_id ? await listSubmissionsForClaim(submission.claim_id) : [];
    return { submission, history };
  }, [id]);

  if (loading) return <Loading full label="Loading submission…" />;
  if (error || !data) {
    return <ErrorState title="Submission not found" description={error ?? "This submission could not be loaded."} onRetry={reload} />;
  }

  const { submission, history } = data;
  const assignment = submission.claim?.assignment;
  const writer = submission.claim?.writer;
  const alreadyReviewed = submission.status !== "pending";
  const needsFeedback = decision === "revision" || decision === "rejected";

  const confirmReview = async () => {
    if (!decision) return;
    if (needsFeedback && feedback.trim().length < 5) {
      toast.warning("Feedback required", "Please explain your decision so the writer can act on it.");
      return;
    }
    setBusy(true);
    try {
      await reviewSubmission(submission.id, decision, feedback.trim());
      toast.success(
        decision === "approved" ? "Submission approved" : decision === "rejected" ? "Submission rejected" : "Revision requested",
        decision === "approved" ? "Earnings have been credited to the writer's wallet." : "The writer has been notified.",
      );
      setDecision(null);
      setFeedback("");
      reload();
    } catch (err) {
      toast.error("Could not submit review", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader
        title={assignment?.title ?? "Submission review"}
        description={`Submitted ${formatRelative(submission.submitted_at)} by ${displayName(writer)}`}
        actions={
          <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate("/admin/submissions")}>
            Back to submissions
          </Button>
        }
      />

      <div className="iw-grid iw-grid--2-1">
        <div className="stack iw-gap-5">
          <Card flush>
            <CardHeader
              title="Submitted work"
              subtitle={submission.notes ? "Writer's notes and attached files" : "Attached files"}
              actions={<StatusBadge kind="submission" value={submission.status} />}
            />
            <div className="iw-card__body stack iw-gap-4">
              {submission.notes && (
                <div className="iw-quote">
                  <MessageSquare size={15} />
                  <p>{submission.notes}</p>
                </div>
              )}

              <StoredFileList
                files={(submission.files ?? []) as StoredFile[]}
                emptyLabel="No files were attached to this submission."
              />
            </div>
          </Card>

          <Card flush>
            <CardHeader title="Assignment brief" subtitle={assignment?.assignment_code ?? ""} />
            <div className="iw-card__body stack iw-gap-5">
              {assignment?.description && <p className="text-sm text-secondary">{assignment.description}</p>}
              {assignment?.instructions && (
                <div>
                  <div className="iw-field__label iw-mb-4">Instructions</div>
                  <p className="text-sm" style={{ whiteSpace: "pre-wrap" }}>
                    {assignment.instructions}
                  </p>
                </div>
              )}

              <div className="iw-assignment__meta">
                <Meta icon={BookOpen} label="Subject" value={assignment?.subject?.name ?? "—"} />
                <Meta icon={Layers} label="Category" value={assignment?.category?.name ?? "—"} />
                <Meta icon={FileText} label="Words" value={assignment?.words ? formatNumber(assignment.words) : "—"} />
                <Meta icon={Quote} label="Citation" value={assignment?.citation_style ?? "—"} />
                <Meta icon={Timer} label="Duration" value={assignment?.estimated_duration ?? "—"} />
                <Meta icon={Users} label="Max claims" value={assignment?.max_claims ?? 1} />
              </div>
            </div>
          </Card>

          {history.length > 1 && (
            <Card flush>
              <CardHeader title="Submission history" subtitle={`${history.length} submissions for this claim`} />
              <div className="iw-card__body">
                <Timeline
                  items={history.map((item) => ({
                    icon: item.status === "approved" ? CheckCircle2 : item.status === "rejected" ? XCircle : ClipboardList,
                    title: `Version submitted ${formatRelative(item.submitted_at)}`,
                    meta: (
                      <span className="iw-inline iw-gap-2">
                        <StatusBadge kind="submission" value={item.status} dot={false} />
                        {item.feedback ? ` · ${item.feedback}` : ""}
                      </span>
                    ),
                    time: item.submitted_at,
                  }))}
                />
              </div>
            </Card>
          )}
        </div>

        <div className="stack iw-gap-5">
          <Card flush>
            <CardHeader title="Writer" subtitle="Who submitted this work" />
            <div className="iw-card__body">
              <div className="iw-inline iw-gap-3">
                <Avatar name={displayName(writer)} src={writer?.avatar_url} size="lg" />
                <div>
                  <div className="font-medium">{writer?.full_name ?? "Writer"}</div>
                  <div className="text-sm text-secondary">{writer?.email ?? "—"}</div>
                  <div className="iw-mt-2">
                    <StatusBadge kind="account" value={writer?.status} />
                  </div>
                </div>
              </div>
              <div className="iw-divider iw-mt-4" />
              <DescriptionList
                items={[
                  { label: "Claimed", value: formatDate(submission.claim?.claimed_at) },
                  { label: "Submitted", value: formatDateTime(submission.submitted_at) },
                  { label: "Lifetime earnings", value: <Money value={writer?.total_earnings} /> },
                  { label: "Balance", value: <Money value={writer?.available_balance} /> },
                ]}
              />
            </div>
          </Card>

          <Card flush>
            <CardHeader title="Decision" subtitle={alreadyReviewed ? "This submission has been reviewed" : "Approve, request a revision or reject"} />
            <div className="iw-card__body stack iw-gap-4">
              {alreadyReviewed ? (
                <Alert tone={submission.status === "approved" ? "success" : submission.status === "rejected" ? "danger" : "warning"} icon={ShieldCheck}>
                  <div className="font-medium iw-mb-3">Status: {submission.status}</div>
                  {submission.feedback && <p className="text-sm">{submission.feedback}</p>}
                </Alert>
              ) : (
                <>
                  <div className="iw-inline iw-gap-3">
                    <Money value={assignment?.reward} />
                    <span className="text-sm text-secondary">will be credited on approval</span>
                  </div>

                  <Textarea
                    rows={4}
                    placeholder={
                      decision === "revision"
                        ? "Explain what needs to change…"
                        : decision === "rejected"
                          ? "Explain why this is being rejected…"
                          : "Optional feedback for the writer…"
                    }
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                  />

                  {decision && (
                    <Alert
                      tone={decision === "approved" ? "success" : decision === "rejected" ? "danger" : "warning"}
                      title={
                        decision === "approved"
                          ? "Approve and pay"
                          : decision === "revision"
                            ? "Request a revision"
                            : "Reject submission"
                      }
                    >
                      {decision === "approved"
                        ? "This credits the writer's wallet exactly once."
                        : decision === "revision"
                          ? "The assignment returns to the writer for a rewrite."
                          : "The assignment will be cancelled and the writer notified."}
                    </Alert>
                  )}

                  <div className="stack iw-gap-3">
                    <Button
                      variant="success"
                      icon={CheckCircle2}
                      loading={busy && decision === "approved"}
                      disabled={busy}
                      onClick={() => {
                        if (decision !== "approved") setDecision("approved");
                        else void confirmReview();
                      }}
                    >
                      {decision === "approved" ? "Confirm approval" : "Approve"}
                    </Button>
                    <Button
                      variant="warning-soft"
                      icon={RefreshCcw}
                      loading={busy && decision === "revision"}
                      disabled={busy}
                      onClick={() => {
                        if (decision !== "revision") setDecision("revision");
                        else void confirmReview();
                      }}
                    >
                      {decision === "revision" ? "Confirm revision request" : "Request revision"}
                    </Button>
                    <Button
                      variant="danger-soft"
                      icon={XCircle}
                      loading={busy && decision === "rejected"}
                      disabled={busy}
                      onClick={() => {
                        if (decision !== "rejected") setDecision("rejected");
                        else void confirmReview();
                      }}
                    >
                      {decision === "rejected" ? "Confirm rejection" : "Reject"}
                    </Button>
                    {decision && (
                      <Button variant="ghost" onClick={() => setDecision(null)} disabled={busy}>
                        Clear selection
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card flush>
            <CardHeader title="Deadline" subtitle="Assignment timing" />
            <div className="iw-card__body">
              <Meta icon={CalendarClock} label="Due" value={formatDateTime(assignment?.deadline)} />
              <div className="iw-mt-3">
                <StatusBadge kind="assignment" value={assignment?.status} />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {!submission.files?.length && !submission.notes && (
        <EmptyState icon={FileText} title="No content attached" description="The writer did not attach files or notes." compact className="iw-mt-5" />
      )}
    </div>
  );
}
