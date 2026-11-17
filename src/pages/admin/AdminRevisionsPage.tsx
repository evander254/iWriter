import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, RefreshCcw } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  Table,
  Td,
  Th,
} from "../../components/common";
import { useAsync } from "../../hooks/useAsync";
import { listAllRevisionRequests } from "../../services";
import { displayName } from "../../types";
import { formatRelative } from "../../utils/date";

export function AdminRevisionsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const { data, loading, error, reload } = useAsync(() => listAllRevisionRequests(), []);

  const rows = (data ?? []).filter((r) => (filter === "pending" ? r.status === "pending" : true));

  return (
    <div className="animate-fade">
      <PageHeader
        title="Revision requests"
        description="Feedback you have asked writers to action before resubmission."
      />

      <Card flush>
        <div className="iw-toolbar">
          <div className="iw-filters">
            <Chip active={filter === "pending"} count={(data ?? []).filter((r) => r.status === "pending").length} onClick={() => setFilter("pending")}>
              Pending
            </Chip>
            <Chip active={filter === "all"} count={data?.length ?? 0} onClick={() => setFilter("all")}>
              All
            </Chip>
          </div>
        </div>

        {loading ? (
          <Loading label="Loading revisions…" />
        ) : error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={RefreshCcw}
            title={filter === "pending" ? "No pending revisions" : "No revision requests yet"}
            description="When you request a revision on a submission, it appears here."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Assignment</Th>
                <Th>Writer</Th>
                <Th>Feedback</Th>
                <Th>Requested</Th>
                <Th>Status</Th>
                <Th className="iw-table__num">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((revision) => {
                const submission = revision.submission;
                const claim = submission?.claim;
                return (
                  <tr key={revision.id}>
                    <Td>
                      <div className="iw-table__primary truncate" style={{ maxWidth: 260 }}>
                        {claim?.assignment?.title ?? "Submission"}
                      </div>
                      <div className="iw-table__sub mono">{claim?.assignment?.assignment_code ?? "—"}</div>
                    </Td>
                    <Td>
                      <div className="iw-inline iw-gap-3">
                        <Avatar name={displayName(claim?.writer)} src={claim?.writer?.avatar_url} size="sm" />
                        <span className="text-sm">{claim?.writer?.full_name ?? "Writer"}</span>
                      </div>
                    </Td>
                    <Td>
                      <span className="text-sm text-secondary clamp-2" style={{ maxWidth: 320 }}>
                        {revision.feedback ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-sm">{formatRelative(revision.created_at)}</span>
                    </Td>
                    <Td>
                      <Badge tone={revision.status === "pending" ? "warning" : "success"} dot>
                        {revision.status}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="iw-table__actions">
                        {submission && (
                          <Button
                            size="sm"
                            variant="outline"
                            icon={Eye}
                            onClick={() => navigate(`/admin/submissions/${submission.id}`)}
                          >
                            View
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <p className="text-xs text-muted iw-mt-4">
        Revision requests close automatically when the writer resubmits. Approving an assignment closes any remaining open revision requests while preserving their history.
      </p>
    </div>
  );
}
