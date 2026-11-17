import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  Trash2,
  Ban,
} from "lucide-react";
import {
  Button,
  Card,
  Chip,
  ConfirmDialog,
  Dropdown,
  EmptyState,
  ErrorState,
  IconButton,
  Loading,
  Money,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  SortHeader,
  Table,
  Td,
  Th,
} from "../../components/common";
import { StatusBadge } from "../../components/common/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { useDebouncedValue } from "../../hooks/useUi";
import { useToast } from "../../contexts/ToastContext";
import {
  deleteAssignment,
  getClaimCounts,
  listAssignments,
  listCategories,
  listSubjects,
  setAssignmentStatus,
} from "../../services";
import type { Assignment, AssignmentStatus } from "../../types/models";
import { formatDate } from "../../utils/date";

const STATUS_TABS: Array<{ value: AssignmentStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "available", label: "Available" },
  { value: "claimed", label: "Claimed" },
  { value: "pending_review", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function AdminAssignmentsPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AssignmentStatus | "all">("all");
  const [subjectId, setSubjectId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [confirm, setConfirm] = useState<{ assignment: Assignment; action: "delete" | "cancel" | "publish" } | null>(null);
  const [busy, setBusy] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 350);

  const { data: reference } = useAsync(async () => {
    const [subjects, categories] = await Promise.all([listSubjects(), listCategories()]);
    return { subjects, categories };
  }, []);

  const { data, loading, error, reload } = useAsync(
    () =>
      listAssignments({
        page,
        pageSize: 10,
        search: debouncedSearch,
        status: status === "all" ? undefined : status,
        subjectId: subjectId || undefined,
        categoryId: categoryId || undefined,
        sortBy,
        sortDir,
      }),
    [page, debouncedSearch, status, subjectId, categoryId, sortBy, sortDir],
  );

  const claimCounts = useAsync(
    async (): Promise<Record<string, number>> => (data ? getClaimCounts(data.rows.map((a) => a.id)) : {}),
    [data],
  );

  const subjectMap = useMemo(
    () => new Map((reference?.subjects ?? []).map((s) => [s.id, s.name])),
    [reference],
  );
  const categoryMap = useMemo(
    () => new Map((reference?.categories ?? []).map((c) => [c.id, c.name])),
    [reference],
  );

  const handleSort = (field: string) => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(field);
      setSortDir("desc");
    }
  };

  const runAction = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.action === "delete") {
        await deleteAssignment(confirm.assignment.id);
        toast.success("Assignment deleted", "The assignment and its history were removed.");
      } else {
        await setAssignmentStatus(confirm.assignment.id, confirm.action === "publish" ? "available" : "cancelled");
        toast.success(
          confirm.action === "publish" ? "Assignment published" : "Assignment cancelled",
          confirm.action === "publish"
            ? "Writers can now claim this assignment."
            : "The assignment is no longer claimable.",
        );
      }
      setConfirm(null);
      reload();
    } catch (err) {
      toast.error("Action failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader
        title="Assignments"
        description="Create, publish and manage every assignment on the platform."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => navigate("/admin/assignments/new")}>
            New assignment
          </Button>
        }
      />

      <Card flush>
        <div className="iw-toolbar">
          <SearchInput
            className="iw-toolbar__grow"
            placeholder="Search by title or code…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setPage(1);
            }}
            style={{ width: 170 }}
          >
            <option value="">All subjects</option>
            {(reference?.subjects ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            style={{ width: 170 }}
          >
            <option value="">All categories</option>
            {(reference?.categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
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
          <Loading label="Loading assignments…" />
        ) : error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No assignments found"
            description="Try adjusting your filters, or create a new assignment to get started."
            action={
              <Button variant="primary" icon={Plus} onClick={() => navigate("/admin/assignments/new")}>
                New assignment
              </Button>
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <SortHeader label="Assignment" field="title" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <Th>Subject / Category</Th>
                  <SortHeader label="Reward" field="reward" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} numeric />
                  <SortHeader label="Deadline" field="deadline" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <Th numeric>Claims</Th>
                  <Th>Status</Th>
                  <Th className="iw-table__num">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((assignment) => (
                  <tr key={assignment.id}>
                    <Td>
                      <div className="iw-table__primary truncate" style={{ maxWidth: 300 }}>
                        {assignment.title}
                      </div>
                      <div className="iw-table__sub mono">{assignment.assignment_code ?? "—"}</div>
                    </Td>
                    <Td>
                      <div className="text-sm">{subjectMap.get(assignment.subject_id ?? "") ?? "—"}</div>
                      <div className="iw-table__sub">{categoryMap.get(assignment.category_id ?? "") ?? "—"}</div>
                    </Td>
                    <Td numeric>
                      <Money value={assignment.reward} />
                    </Td>
                    <Td>
                      <div className="text-sm">{formatDate(assignment.deadline)}</div>
                      <div className="iw-table__sub">{assignment.priority}</div>
                    </Td>
                    <Td numeric>
                      {claimCounts.data?.[assignment.id] ?? 0}
                      <span className="text-muted">/{assignment.max_claims ?? 1}</span>
                    </Td>
                    <Td>
                      <StatusBadge kind="assignment" value={assignment.status} />
                    </Td>
                    <Td>
                      <div className="iw-table__actions">
                        <IconButton icon={Eye} label="View" size="sm" onClick={() => navigate(`/admin/assignments/${assignment.id}`)} />
                        <IconButton icon={Pencil} label="Edit" size="sm" onClick={() => navigate(`/admin/assignments/${assignment.id}/edit`)} />
                        <Dropdown
                          trigger={<IconButton icon={MoreHorizontal} label="More actions" size="sm" />}
                          items={[
                            ...(assignment.status === "draft"
                              ? [{ label: "Publish", icon: Send, onClick: () => setConfirm({ assignment, action: "publish" }) }]
                              : []),
                            ...(assignment.status !== "cancelled" && assignment.status !== "completed"
                              ? [{ label: "Cancel assignment", icon: Ban, onClick: () => setConfirm({ assignment, action: "cancel" }) }]
                              : []),
                            "divider" as const,
                            { label: "Delete", icon: Trash2, danger: true, onClick: () => setConfirm({ assignment, action: "delete" }) },
                          ]}
                        />
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

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={runAction}
        loading={busy}
        title={
          confirm?.action === "delete"
            ? "Delete assignment?"
            : confirm?.action === "publish"
              ? "Publish assignment?"
              : "Cancel assignment?"
        }
        description={
          confirm?.action === "delete"
            ? "This permanently removes the assignment. Existing claims and submissions may also be removed."
            : confirm?.action === "publish"
              ? "Writers will be able to see and claim this assignment immediately."
              : "Writers will no longer be able to claim this assignment."
        }
        confirmLabel={confirm?.action === "delete" ? "Delete" : confirm?.action === "publish" ? "Publish" : "Cancel assignment"}
        tone={confirm?.action === "delete" ? "danger" : confirm?.action === "cancel" ? "warning-soft" : "primary"}
      />
    </div>
  );
}
