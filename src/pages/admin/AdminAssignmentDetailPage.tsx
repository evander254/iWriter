import { useNavigate, useParams } from "react-router-dom";
import {
  AlarmClock,
  ArrowLeft,
  BookOpen,
  CalendarClock,
  ClipboardList,
  FileText,
  Layers,
  Pencil,
  Quote,
  Send,
  Timer,
  Users,
  Wallet,
} from "lucide-react";
import {
  Avatar,
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
  Table,
  Td,
  Th,
  Timeline,
} from "../../components/common";
import { StatusBadge } from "../../components/common/StatusBadge";
import { StoredFileList, type StoredFile } from "../../components/forms/FileUpload";
import { useAsync } from "../../hooks/useAsync";
import { getAssignment, listAllClaims, listAssignmentHistory } from "../../services";
import { displayName } from "../../types";
import { formatCountdown, formatDateTime, formatRelative } from "../../utils/date";
import { formatNumber } from "../../utils/format";

export function AdminAssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, loading, error, reload } = useAsync(async () => {
    if (!id) return null;
    const [assignment, claims, history] = await Promise.all([
      getAssignment(id),
      listAllClaims({ assignmentId: id, pageSize: 50 }),
      listAssignmentHistory(id),
    ]);
    return { assignment, claims, history };
  }, [id]);

  if (loading) return <Loading full label="Loading assignment…" />;
  if (error || !data) {
    return <ErrorState title="Assignment not found" description={error ?? "This assignment could not be loaded."} onRetry={reload} />;
  }

  const { assignment, claims, history } = data;
  const approvedCount = claims.rows.filter((c) => c.status === "approved").length;
  const totalPayout = claims.rows.filter((c) => c.status === "approved").length * (assignment.reward ?? 0);

  return (
    <div className="animate-fade">
      <PageHeader
        title={assignment.title}
        description={assignment.assignment_code ?? "Assignment"}
        actions={
          <>
            <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate("/admin/assignments")}>
              Back
            </Button>
            <Button variant="outline" icon={Pencil} onClick={() => navigate(`/admin/assignments/${assignment.id}/edit`)}>
              Edit
            </Button>
          </>
        }
      />

      <div className="iw-inline iw-gap-3 iw-mb-5" style={{ flexWrap: "wrap" }}>
        <StatusBadge kind="assignment" value={assignment.status} />
        <StatusBadge kind="priority" value={assignment.priority} dot={false} />
        {assignment.subject?.name && <Badge tone="accent">{assignment.subject.name}</Badge>}
        {assignment.category?.name && <Badge tone="neutral">{assignment.category.name}</Badge>}
        <Badge tone="outline">{assignment.visibility ?? "public"}</Badge>
        <Badge tone="neutral" icon={AlarmClock}>
          {formatCountdown(assignment.deadline)}
        </Badge>
      </div>

      <div className="iw-grid iw-grid--2-1">
        <div className="stack iw-gap-5">
          <Card flush>
            <CardHeader title="Brief" subtitle="What the writer needs to produce" />
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
                <p className="text-sm text-muted">No detailed instructions provided.</p>
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
              <div className="iw-divider iw-mt-5" />
              <div className="iw-mt-4">
                <DescriptionList
                  items={[
                    { label: "Academic level", value: assignment.academic_level ?? "—" },
                    { label: "Spacing", value: assignment.spacing ?? "—" },
                    { label: "File format", value: assignment.file_format ?? "—" },
                    { label: "Deadline", value: formatDateTime(assignment.deadline) },
                  ]}
                />
              </div>
            </div>
          </Card>

          <Card flush>
            <CardHeader title="Attachments" subtitle={`${assignment.attachments?.length ?? 0} file(s)`} />
            <div className="iw-card__body">
              <StoredFileList
                files={(assignment.attachments ?? []) as StoredFile[]}
                emptyLabel="No files were attached to this assignment."
              />
            </div>
          </Card>

          <Card flush>
            <CardHeader title="Claims" subtitle={`${claims.count} writer(s) have claimed this assignment`} />
            {claims.rows.length === 0 ? (
              <EmptyState icon={Users} title="No claims yet" description="Writers have not picked this up." compact />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Writer</Th>
                    <Th>Claimed</Th>
                    <Th>Submitted</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {claims.rows.map((claim) => (
                    <tr key={claim.id}>
                      <Td>
                        <div className="iw-inline iw-gap-3">
                          <Avatar name={displayName(claim.writer)} src={claim.writer?.avatar_url} size="sm" />
                          <span className="text-sm">{claim.writer?.full_name ?? "Writer"}</span>
                        </div>
                      </Td>
                      <Td>
                        <span className="text-sm">{formatRelative(claim.claimed_at)}</span>
                      </Td>
                      <Td>
                        <span className="text-sm">{claim.submitted_at ? formatRelative(claim.submitted_at) : "—"}</span>
                      </Td>
                      <Td>
                        <StatusBadge kind="claim" value={claim.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="stack iw-gap-5">
          <Card flush>
            <CardHeader title="Compensation" subtitle="Payout details" />
            <div className="iw-card__body stack iw-gap-4">
              <div>
                <div className="iw-reward">{assignment.reward != null ? `$${formatNumber(assignment.reward)}` : "—"}</div>
                <div className="iw-reward__label">Reward per approved submission</div>
              </div>
              <div className="iw-divider" />
              <div className="iw-between">
                <span className="text-sm text-secondary">Approved</span>
                <Badge tone="success">{approvedCount}</Badge>
              </div>
              <div className="iw-between">
                <span className="text-sm text-secondary">Total payout</span>
                <Money value={totalPayout} />
              </div>
              <div className="iw-between">
                <span className="text-sm text-secondary">Capacity</span>
                <span className="text-sm font-medium">
                  {claims.count} / {assignment.max_claims ?? 1}
                </span>
              </div>
            </div>
          </Card>

          <Card flush>
            <CardHeader title="Timeline" subtitle="Assignment lifecycle" />
            <div className="iw-card__body">
              {history.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No history yet" compact />
              ) : (
                <Timeline
                  items={history.map((entry) => ({
                    title: `${entry.old_status ?? "—"} → ${entry.new_status ?? "—"}`,
                    meta: entry.remarks ?? undefined,
                    time: entry.created_at,
                  }))}
                />
              )}
            </div>
          </Card>

          <Card flush>
            <CardHeader title="Quick facts" />
            <div className="iw-card__body">
              <DescriptionList
                items={[
                  { label: "Created", value: formatDateTime(assignment.created_at) },
                  { label: "Updated", value: formatDateTime(assignment.updated_at) },
                  { label: "Code", value: <span className="mono">{assignment.assignment_code ?? "—"}</span> },
                  { label: "Status", value: <StatusBadge kind="assignment" value={assignment.status} dot={false} /> },
                ]}
              />
            </div>
          </Card>

          {assignment.status === "draft" && (
            <Button variant="primary" icon={Send} onClick={() => navigate(`/admin/assignments/${assignment.id}/edit`)}>
              Continue editing to publish
            </Button>
          )}
          {assignment.status !== "draft" && (
            <Card flush>
              <div className="iw-card__body">
                <div className="iw-inline iw-gap-3">
                  <span className="iw-stat__icon iw-stat__icon--accent" style={{ width: 34, height: 34 }}>
                    <CalendarClock size={17} />
                  </span>
                  <div>
                    <div className="font-medium">Deadline</div>
                    <div className="text-sm text-secondary">{formatDateTime(assignment.deadline)}</div>
                  </div>
                </div>
                <div className="iw-mt-4">
                  <Button variant="outline" icon={Wallet} block onClick={() => navigate(`/admin/claims`)}>
                    View all claims
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
