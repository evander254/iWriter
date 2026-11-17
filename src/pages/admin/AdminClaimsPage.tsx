import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Eye, FileCheck2, MessageSquare } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
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
import { listAllClaims } from "../../services";
import type { ClaimStatus } from "../../types/models";
import { displayName } from "../../types";
import { formatDate, formatRelative } from "../../utils/date";

const STATUS_TABS: Array<{ value: ClaimStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "claimed", label: "In progress" },
  { value: "submitted", label: "Submitted" },
  { value: "revision", label: "Revision" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export function AdminClaimsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ClaimStatus | "all">("all");
  const [sortBy, setSortBy] = useState("claimed_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const debounced = useDebouncedValue(search, 350);

  const { data, loading, error, reload } = useAsync(
    () =>
      listAllClaims({
        page,
        pageSize: 12,
        search: debounced,
        status: status === "all" ? undefined : status,
        sortBy,
        sortDir,
      }),
    [page, debounced, status, sortBy, sortDir],
  );

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
        title="Assignment claims"
        description="Every assignment a writer has picked up, and where it stands in the pipeline."
      />

      <Card flush>
        <div className="iw-toolbar">
          <SearchInput
            className="iw-toolbar__grow"
            placeholder="Search by assignment title or code…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
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
          <Loading label="Loading claims…" />
        ) : error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No claims found"
            description="Claims appear here as writers pick up assignments."
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Assignment</Th>
                  <Th>Writer</Th>
                  <SortHeader label="Reward" field="claimed_at" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} numeric />
                  <Th>Claimed</Th>
                  <Th>Submitted</Th>
                  <Th>Reviewed</Th>
                  <Th>Status</Th>
                  <Th className="iw-table__num">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((claim) => (
                  <tr key={claim.id}>
                    <Td>
                      <div className="iw-table__primary truncate" style={{ maxWidth: 260 }}>
                        {claim.assignment?.title ?? "Assignment"}
                      </div>
                      <div className="iw-table__sub mono">{claim.assignment?.assignment_code ?? "—"}</div>
                    </Td>
                    <Td>
                      <div className="iw-inline iw-gap-3">
                        <Avatar name={displayName(claim.writer)} src={claim.writer?.avatar_url} size="sm" />
                        <span className="text-sm truncate" style={{ maxWidth: 160 }}>
                          {claim.writer?.full_name ?? "Writer"}
                        </span>
                      </div>
                    </Td>
                    <Td numeric>
                      <Money value={claim.assignment?.reward} />
                    </Td>
                    <Td>
                      <span className="text-sm">{formatRelative(claim.claimed_at)}</span>
                    </Td>
                    <Td>
                      <span className="text-sm">{claim.submitted_at ? formatDate(claim.submitted_at) : "—"}</span>
                    </Td>
                    <Td>
                      <span className="text-sm">{claim.reviewed_at ? formatDate(claim.reviewed_at) : "—"}</span>
                    </Td>
                    <Td>
                      <StatusBadge kind="claim" value={claim.status} />
                    </Td>
                    <Td>
                      <div className="iw-table__actions">
                        {claim.assignment && (
                          <IconButton
                            icon={Eye}
                            label="View assignment"
                            size="sm"
                            onClick={() => navigate(`/admin/assignments/${claim.assignment!.id}`)}
                          />
                        )}
                        {claim.status === "submitted" && (
                          <Button
                            size="sm"
                            variant="outline"
                            icon={FileCheck2}
                            onClick={() => navigate(`/admin/submissions?claim=${claim.id}`)}
                          >
                            Review
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={data.pageSize} total={data.count} onPageChange={setPage} />
          </>
        )}
      </Card>

      <div className="iw-inline iw-gap-2 iw-mt-4 text-xs text-muted">
        <MessageSquare size={13} />
        <span>Tip: open a submission to approve, reject or request a revision.</span>
        <Badge tone="neutral">Live data</Badge>
      </div>
    </div>
  );
}
