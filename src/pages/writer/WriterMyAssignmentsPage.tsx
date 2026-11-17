import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, CheckCircle2, ClipboardList, Eye, FileClock, RefreshCcw, Send } from "lucide-react";
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
import { countWriterClaimsByStatus, listWriterClaims } from "../../services";
import type { ClaimStatus } from "../../types/models";
import { formatCountdown, formatDateTime, formatRelative } from "../../utils/date";

const STATUS_TABS: Array<{ value: ClaimStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "claimed", label: "In progress" },
  { value: "submitted", label: "Submitted" },
  { value: "revision", label: "Revision" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export function WriterMyAssignmentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ClaimStatus | "all">("all");
  const [sortBy, setSortBy] = useState("claimed_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const debounced = useDebouncedValue(search, 350);

  const { data, loading, error, reload } = useAsync(
    () =>
      user
        ? listWriterClaims(user.id, {
            page,
            pageSize: 10,
            search: debounced,
            status: status === "all" ? undefined : status,
            sortBy,
            sortDir,
          })
        : Promise.resolve(null),
    [user?.id, page, debounced, status, sortBy, sortDir],
  );

  const { data: counts } = useAsync(
    async () => (user ? countWriterClaimsByStatus(user.id) : null),
    [user?.id],
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
        title="My assignments"
        description="Everything you have claimed, and its progress through review."
        actions={
          <Button variant="primary" icon={ClipboardList} onClick={() => navigate("/writer/assignments")}>
            Find more work
          </Button>
        }
      />

      <div className="iw-grid iw-grid--stats iw-mb-5">
        <Card>
          <div className="iw-stat__label">In progress</div>
          <div className="iw-stat__value">{counts?.claimed ?? 0}</div>
          <Badge tone="info" dot>
            Ready to submit
          </Badge>
        </Card>
        <Card>
          <div className="iw-stat__label">Awaiting review</div>
          <div className="iw-stat__value">{counts?.submitted ?? 0}</div>
          <Badge tone="warning" dot>
            Under review
          </Badge>
        </Card>
        <Card>
          <div className="iw-stat__label">Revisions</div>
          <div className="iw-stat__value">{counts?.revision ?? 0}</div>
          <Badge tone="warning" dot>
            Action needed
          </Badge>
        </Card>
        <Card>
          <div className="iw-stat__label">Approved</div>
          <div className="iw-stat__value">{counts?.approved ?? 0}</div>
          <Badge tone="success" dot>
            Paid
          </Badge>
        </Card>
      </div>

      <Card flush>
        <div className="iw-toolbar">
          <SearchInput
            className="iw-toolbar__grow"
            placeholder="Search your assignments…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Button variant="ghost" icon={RefreshCcw} onClick={reload}>
            Refresh
          </Button>
        </div>
        <div className="iw-toolbar" style={{ borderTop: "none", paddingTop: 0 }}>
          <div className="iw-filters">
            {STATUS_TABS.map((tab) => (
              <Chip
                key={tab.value}
                active={status === tab.value}
                count={tab.value !== "all" && counts ? counts[tab.value as ClaimStatus] : undefined}
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
          <Loading label="Loading your assignments…" />
        ) : error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={status === "all" ? "No assignments yet" : "Nothing in this status"}
            description={
              status === "all"
                ? "Browse the marketplace to claim your first assignment."
                : "Try a different filter to see more of your work."
            }
            action={
              status === "all" ? (
                <Button variant="primary" icon={ClipboardList} onClick={() => navigate("/writer/assignments")}>
                  Browse assignments
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Assignment</Th>
                  <Th>Deadline</Th>
                  <SortHeader label="Reward" field="claimed_at" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} numeric />
                  <Th>Claimed</Th>
                  <Th>Status</Th>
                  <Th className="iw-table__num">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((claim) => {
                  const canSubmit = claim.status === "claimed" || claim.status === "revision";
                  return (
                    <tr key={claim.id}>
                      <Td>
                        <div className="iw-table__primary truncate" style={{ maxWidth: 320 }}>
                          {claim.assignment?.title ?? "Assignment"}
                        </div>
                        <div className="iw-table__sub mono">{claim.assignment?.assignment_code ?? "—"}</div>
                      </Td>
                      <Td>
                        <span className="text-sm">{formatDateTime(claim.assignment?.deadline)}</span>
                        <div className="iw-table__sub">{formatCountdown(claim.assignment?.deadline)}</div>
                      </Td>
                      <Td numeric>
                        <Money value={claim.assignment?.reward} />
                      </Td>
                      <Td>
                        <span className="text-sm">{formatRelative(claim.claimed_at)}</span>
                      </Td>
                      <Td>
                        <StatusBadge kind="claim" value={claim.status} />
                      </Td>
                      <Td>
                        <div className="iw-table__actions">
                          {claim.assignment && (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={Eye}
                              onClick={() => navigate(`/writer/assignments/${claim.assignment!.id}`)}
                            >
                              Brief
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant={canSubmit ? "primary" : "outline"}
                            icon={canSubmit ? Send : FileClock}
                            onClick={() => navigate(`/writer/my-assignments/${claim.id}`)}
                          >
                            {claim.status === "claimed" ? "Submit" : claim.status === "revision" ? "Resubmit" : "Open"}
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={data.pageSize} total={data.count} onPageChange={setPage} />
          </>
        )}
      </Card>

      <p className="text-xs text-muted iw-mt-4 iw-inline iw-gap-2">
        <CheckCircle2 size={13} /> Approved work is credited to your wallet automatically.
      </p>
    </div>
  );
}
