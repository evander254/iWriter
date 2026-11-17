import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, FileCheck2, FileClock, MessageSquare, Paperclip } from "lucide-react";
import {
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
import { useAuth } from "../../contexts/AuthContext";
import { listWriterSubmissions } from "../../services";
import type { SubmissionStatus } from "../../types/models";
import { formatRelative } from "../../utils/date";

const STATUS_TABS: Array<{ value: SubmissionStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "revision", label: "Revision" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export function WriterSubmissionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SubmissionStatus | "all">("all");
  const [sortBy, setSortBy] = useState("submitted_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const debounced = useDebouncedValue(search, 350);

  const { data, loading, error, reload } = useAsync(
    () =>
      user
        ? listWriterSubmissions(user.id, {
            page,
            pageSize: 10,
            status: status === "all" ? undefined : status,
            sortBy,
            sortDir,
          })
        : Promise.resolve(null),
    [user?.id, page, status, sortBy, sortDir],
  );

  const filtered = (data?.rows ?? []).filter((s) => {
    if (!debounced.trim()) return true;
    const term = debounced.toLowerCase();
    return (
      (s.claim?.assignment?.title ?? "").toLowerCase().includes(term) ||
      (s.claim?.assignment?.assignment_code ?? "").toLowerCase().includes(term)
    );
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
        description="Every version of work you have submitted and its review outcome."
      />

      <Card flush>
        <div className="iw-toolbar">
          <SearchInput
            className="iw-toolbar__grow"
            placeholder="Search submissions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="iw-toolbar" style={{ borderTop: "none", paddingTop: 0 }}>
          <div className="iw-filters">
            {STATUS_TABS.map((tab) => (
              <Chip
                key={tab.value}
                active={status === tab.value}
                onClick={() => {
                  setStatus(tab.value);
                  setPage(1);
                }}
              >
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
            title={status === "all" ? "No submissions yet" : "Nothing in this status"}
            description="Submit work from your assignments and it will appear here."
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Assignment</Th>
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
                      <div className="iw-table__primary truncate" style={{ maxWidth: 300 }}>
                        {submission.claim?.assignment?.title ?? "Submission"}
                      </div>
                      <div className="iw-table__sub mono">{submission.claim?.assignment?.assignment_code ?? "—"}</div>
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
                        {submission.claim_id && (
                          <Button
                            size="sm"
                            variant={submission.status === "revision" ? "primary" : "outline"}
                            icon={submission.status === "revision" ? FileClock : Eye}
                            onClick={() => navigate(`/writer/my-assignments/${submission.claim_id}`)}
                          >
                            {submission.status === "revision" ? "Resubmit" : "Open"}
                          </Button>
                        )}
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

      {filtered.some((s) => s.feedback) && (
        <div className="iw-mt-5 stack iw-gap-3">
          <h2 className="iw-form-section__title">Recent feedback</h2>
          {filtered
            .filter((s) => s.feedback)
            .slice(0, 3)
            .map((s) => (
              <Card key={s.id}>
                <div className="iw-inline iw-gap-3">
                  <MessageSquare size={16} className="text-muted" />
                  <div>
                    <div className="font-medium">{s.claim?.assignment?.title ?? "Submission"}</div>
                    <p className="text-sm text-secondary">{s.feedback}</p>
                  </div>
                </div>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
