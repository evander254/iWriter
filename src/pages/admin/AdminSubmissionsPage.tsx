import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, FileCheck2, Paperclip } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Loading,
  Money,
  PageHeader,
  Pagination,
  SearchInput,
  SortHeader,
  Table,
  Td,
  Th,
} from "../../components/common";
import { StatusBadge } from "../../components/common/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { useDebouncedValue } from "../../hooks/useUi";
import { listAllSubmissions } from "../../services";
import type { SubmissionStatus } from "../../types/models";
import { displayName } from "../../types";
import { formatRelative } from "../../utils/date";

const STATUS_TABS: Array<{ value: SubmissionStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending review" },
  { value: "revision", label: "Revision" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export function AdminSubmissionsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const claimFilter = params.get("claim") ?? "";

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SubmissionStatus | "all">("pending");
  const [sortBy, setSortBy] = useState("submitted_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const debounced = useDebouncedValue(search, 350);

  useEffect(() => {
    setPage(1);
  }, [claimFilter, debounced, status]);

  const { data, loading, error, reload } = useAsync(
    () =>
      listAllSubmissions({
        page,
        pageSize: 12,
        status: status === "all" ? undefined : status,
        claimId: claimFilter || undefined,
        sortBy,
        sortDir,
      }),
    [page, status, claimFilter, sortBy, sortDir],
  );

  const filtered = (data?.rows ?? []).filter((s) => {
    if (!debounced.trim()) return true;
    const term = debounced.toLowerCase();
    const title = s.claim?.assignment?.title?.toLowerCase() ?? "";
    const writer = (s.claim?.writer?.full_name ?? "").toLowerCase();
    const code = s.claim?.assignment?.assignment_code?.toLowerCase() ?? "";
    return title.includes(term) || writer.includes(term) || code.includes(term);
  });

  const handleSort = (field: string) => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(field);
      setSortDir("desc");
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader
        title="Submissions"
        description="Review submitted work, approve it, request a revision or reject it."
      />

      {claimFilter && (
        <div className="iw-mb-5">
          <Badge tone="accent" lg>
            Filtered to a single claim
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            className="iw-ml-3"
            onClick={() => {
              params.delete("claim");
              setParams(params);
            }}
          >
            Clear filter
          </Button>
        </div>
      )}

      <Card flush>
        <div className="iw-toolbar">
          <SearchInput
            className="iw-toolbar__grow"
            placeholder="Search by assignment or writer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="iw-toolbar" style={{ borderTop: "none", paddingTop: 0 }}>
          <div className="iw-filters">
            {STATUS_TABS.map((tab) => (
              <Chip key={tab.value} active={status === tab.value} onClick={() => setStatus(tab.value)}>
                {tab.label}
              </Chip>
            ))}
          </div>
        </div>

        {loading ? (
          <Loading label="Loading submissions…" />
        ) : error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileCheck2}
            title={status === "pending" ? "Nothing awaiting review" : "No submissions found"}
            description={
              status === "pending"
                ? "You're all caught up. New submissions will appear here."
                : "Try adjusting your filters or search."
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Assignment</Th>
                  <Th>Writer</Th>
                  <Th>Files</Th>
                  <SortHeader label="Submitted" field="submitted_at" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <Th numeric>Reward</Th>
                  <Th>Status</Th>
                  <Th className="iw-table__num">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((submission) => (
                  <tr key={submission.id}>
                    <Td>
                      <div className="iw-table__primary truncate" style={{ maxWidth: 280 }}>
                        {submission.claim?.assignment?.title ?? "Submission"}
                      </div>
                      <div className="iw-table__sub mono">{submission.claim?.assignment?.assignment_code ?? "—"}</div>
                    </Td>
                    <Td>
                      <div className="iw-inline iw-gap-3">
                        <Avatar name={displayName(submission.claim?.writer)} src={submission.claim?.writer?.avatar_url} size="sm" />
                        <span className="text-sm truncate" style={{ maxWidth: 160 }}>
                          {submission.claim?.writer?.full_name ?? "Writer"}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={submission.files?.length ? "accent" : "neutral"} icon={Paperclip}>
                        {submission.files?.length ?? 0}
                      </Badge>
                    </Td>
                    <Td>
                      <span className="text-sm">{formatRelative(submission.submitted_at)}</span>
                    </Td>
                    <Td numeric>
                      <Money value={submission.claim?.assignment?.reward} />
                    </Td>
                    <Td>
                      <StatusBadge kind="submission" value={submission.status} />
                    </Td>
                    <Td>
                      <div className="iw-table__actions">
                        <Button
                          size="sm"
                          variant={submission.status === "pending" ? "primary" : "outline"}
                          icon={Eye}
                          onClick={() => navigate(`/admin/submissions/${submission.id}`)}
                        >
                          {submission.status === "pending" ? "Review" : "View"}
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={data!.pageSize} total={data!.count} onPageChange={setPage} />
          </>
        )}
      </Card>

      <p className="text-xs text-muted iw-mt-4">
        Approving a submission credits the writer's wallet exactly once and cannot be duplicated.
      </p>
    </div>
  );
}
