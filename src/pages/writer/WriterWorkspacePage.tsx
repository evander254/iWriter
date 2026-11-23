import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlarmClock,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  FileText,
  Layers,
  MessageSquare,
  Quote,
  Send,
  Timer,
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
  Textarea,
  Timeline,
} from "../../components/common";
import { StatusBadge } from "../../components/common/StatusBadge";
import { FileUpload, StoredFileList, type StoredFile } from "../../components/forms/FileUpload";
import { InstructionContent } from "../../components/assignments/InstructionContent";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../contexts/ToastContext";
import {
  getClaim,
  listSubmissionsForClaim,
  submitWork,
  STORAGE_FOLDERS,
  uploadFiles,
} from "../../services";
import { formatCountdown, formatDateTime, formatRelative } from "../../utils/date";
import { formatNumber } from "../../utils/format";

export function WriterWorkspacePage() {
  const { claimId } = useParams<{ claimId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    if (!claimId) return null;
    const claim = await getClaim(claimId);
    const submissions = await listSubmissionsForClaim(claimId);
    return { claim, submissions };
  }, [claimId]);

  if (loading) return <Loading full label="Loading workspace…" />;
  if (error || !data) {
    return <ErrorState title="Assignment not found" description={error ?? "This claim could not be loaded."} onRetry={reload} />;
  }

  const { claim, submissions } = data;
  const assignment = claim.assignment;
  const latest = submissions[0];
  const needsRevision = latest?.status === "revision" || claim.status === "revision";
  const canSubmit = claim.status === "claimed" || claim.status === "revision";
  const locked = claim.status === "approved" || claim.status === "rejected";
  const overdue = assignment?.deadline ? new Date(assignment.deadline) < new Date() : false;

  const handleSubmit = async () => {
    if (!claimId) return;
    if (notes.trim().length < 10 && files.length === 0) {
      toast.warning("Add your work", "Include notes or attach at least one file before submitting.");
      return;
    }
    setBusy(true);
    try {
      const uploaded = files.length > 0 ? await uploadFiles(STORAGE_FOLDERS.submissions, claimId, files) : [];
      await submitWork(
        claimId,
        notes.trim(),
        uploaded.map((u) => ({ file_name: u.name, file_url: u.path })),
      );
      toast.success("Work submitted", "Your submission is now awaiting review.");
      setNotes("");
      setFiles([]);
      reload();
    } catch (err) {
      toast.error("Could not submit work", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader
        title={assignment?.title ?? "Workspace"}
        description={assignment?.assignment_code ?? "Submission workspace"}
        actions={
          <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate("/writer/my-assignments")}>
            Back to my assignments
          </Button>
        }
      />

      <div className="iw-inline iw-gap-3 iw-mb-5" style={{ flexWrap: "wrap" }}>
        <StatusBadge kind="claim" value={claim.status} />
        {assignment && <StatusBadge kind="assignment" value={assignment.status} dot={false} />}
        <Badge tone={overdue ? "danger" : "neutral"} icon={AlarmClock}>
          {formatCountdown(assignment?.deadline)}
        </Badge>
        <Badge tone="accent">
          <Money value={assignment?.reward} />
        </Badge>
      </div>

      {needsRevision && latest?.feedback && (
        <Alert tone="warning" title="Revision requested" icon={MessageSquare} className="iw-mb-5">
          <p className="text-sm">{latest.feedback}</p>
        </Alert>
      )}

      {locked && (
        <Alert
          tone={claim.status === "approved" ? "success" : "danger"}
          title={claim.status === "approved" ? "Assignment approved" : "Assignment rejected"}
          className="iw-mb-5"
        >
          {claim.status === "approved"
            ? "Great work! Your earnings have been credited to your wallet."
            : latest?.feedback || "This assignment was rejected. Contact support if you have questions."}
        </Alert>
      )}

      <div className="iw-grid iw-grid--2-1">
        <div className="stack iw-gap-5">
          <Card flush>
            <CardHeader
              title={canSubmit ? (needsRevision ? "Resubmit your work" : "Submit your work") : "Submission"}
              subtitle={
                canSubmit
                  ? "Attach your final files and add any notes for the reviewer."
                  : "You cannot submit while this assignment is under review or closed."
              }
            />
            <div className="iw-card__body stack iw-gap-4">
              {canSubmit ? (
                <>
                  <FileUpload files={files} onChange={setFiles} disabled={busy} maxFiles={10} />
                  <div>
                    <div className="iw-field__label iw-mb-4">Notes for the reviewer</div>
                    <Textarea
                      rows={5}
                      placeholder="Summarise what you delivered, note any assumptions, or link to sources…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                  <div className="iw-inline iw-gap-3">
                    <Button variant="primary" icon={Send} loading={busy} onClick={handleSubmit}>
                      {needsRevision ? "Resubmit for review" : "Submit for review"}
                    </Button>
                    <span className="text-xs text-muted">
                      {files.length} file(s) attached · {notes.trim().length} characters
                    </span>
                  </div>
                </>
              ) : (
                <Alert tone={claim.status === "approved" ? "success" : "info"} icon={CheckCircle2}>
                  {claim.status === "approved"
                    ? "This assignment has been approved and paid."
                    : claim.status === "rejected"
                      ? "This assignment was rejected."
                      : "Your submission is under review. You'll be notified once a decision is made."}
                </Alert>
              )}
            </div>
          </Card>

          <Card flush>
            <CardHeader title="Assignment brief" subtitle={assignment?.assignment_code ?? ""} />
            <div className="iw-card__body stack iw-gap-5">
              {assignment?.description && <p className="text-sm text-secondary">{assignment.description}</p>}
              {assignment?.instructions ? (
                <div>
                  <div className="iw-field__label iw-mb-4">Instructions</div>
                  <InstructionContent text={assignment.instructions} />
                </div>
              ) : (
                <p className="text-sm text-muted">No detailed instructions were provided.</p>
              )}

              <div className="iw-assignment__meta">
                <Meta icon={FileText} label="Words" value={assignment?.words ? formatNumber(assignment.words) : "—"} />
                <Meta icon={Layers} label="Pages" value={assignment?.pages ?? "—"} />
                <Meta icon={BookOpen} label="Sources" value={assignment?.sources_required ?? "—"} />
                <Meta icon={Quote} label="Citation" value={assignment?.citation_style ?? "—"} />
                <Meta icon={Users} label="Level" value={assignment?.academic_level ?? "—"} />
              </div>
            </div>
          </Card>

          <Card flush>
            <CardHeader title="Client attachments" subtitle={`${assignment?.attachments?.length ?? 0} file(s)`} />
            <div className="iw-card__body">
              <StoredFileList
                files={(assignment?.attachments ?? []) as StoredFile[]}
                emptyLabel="No files were attached to this assignment."
              />
            </div>
          </Card>

          {submissions.length > 0 && (
            <Card flush>
              <CardHeader title="Your submissions" subtitle={`${submissions.length} version(s)`} />
              <div className="iw-card__body stack iw-gap-5">
                {submissions.map((submission) => (
                  <div key={submission.id} className="stack iw-gap-3">
                    <div className="iw-between">
                      <span className="iw-inline iw-gap-3">
                        <StatusBadge kind="submission" value={submission.status} />
                        <span className="text-sm text-secondary">{formatRelative(submission.submitted_at)}</span>
                      </span>
                      <Badge tone="neutral">{submission.files?.length ?? 0} files</Badge>
                    </div>
                    {submission.notes && <p className="text-sm text-secondary">{submission.notes}</p>}
                    {submission.feedback && (
                      <div className="iw-quote">
                        <MessageSquare size={15} />
                        <p className="text-sm">{submission.feedback}</p>
                      </div>
                    )}
                    <StoredFileList files={(submission.files ?? []) as StoredFile[]} emptyLabel="No files attached." />
                    <div className="iw-divider" />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="stack iw-gap-5">
          <Card flush>
            <CardHeader title="At a glance" />
            <div className="iw-card__body">
              <DescriptionList
                items={[
                  { label: "Claimed", value: formatDateTime(claim.claimed_at) },
                  { label: "Deadline", value: formatDateTime(assignment?.deadline) },
                  { label: "Reward", value: <Money value={assignment?.reward} /> },
                  { label: "Subject", value: assignment?.subject?.name ?? "—" },
                  { label: "Category", value: assignment?.category?.name ?? "—" },
                ]}
              />
            </div>
          </Card>

          <Card flush>
            <CardHeader title="Progress" />
            <div className="iw-card__body">
              <Timeline
                items={[
                  { icon: CheckCircle2, title: "Claimed", meta: "Assignment reserved", time: claim.claimed_at },
                  { icon: Send, title: "Submitted", meta: "Awaiting review", time: claim.submitted_at },
                  { icon: CheckCircle2, title: "Reviewed", meta: "Decision recorded", time: claim.reviewed_at },
                ]}
              />
            </div>
          </Card>

          {!canSubmit && !locked && (
            <EmptyState icon={Timer} title="Under review" description="You'll be notified once a reviewer responds." compact />
          )}
        </div>
      </div>
    </div>
  );
}
