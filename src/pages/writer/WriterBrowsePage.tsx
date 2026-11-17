import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Award, Filter, RefreshCcw, SlidersHorizontal, Sparkles } from "lucide-react";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Segmented,
} from "../../components/common";
import { AssignmentCard, AssignmentCardSkeleton } from "../../components/assignments/AssignmentCard";
import { useAsync } from "../../hooks/useAsync";
import { useDebouncedValue } from "../../hooks/useUi";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { claimAssignment, countWriterClaimsByStatus, getMyClaimMap, listCategories, listMarketplaceAssignments, listSubjects } from "../../services";
import { PRIORITY_OPTIONS, ACADEMIC_LEVELS } from "../../lib/status";
import type { AssignmentPriority, Assignment } from "../../types/models";

type SortValue = "newest" | "deadline" | "reward" | "priority";

const SORTS: Array<{ value: SortValue; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "deadline", label: "Deadline" },
  { value: "reward", label: "Highest reward" },
  { value: "priority", label: "Priority" },
];

export function WriterBrowsePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState<AssignmentPriority | "">("");
  const [level, setLevel] = useState("");
  const [sort, setSort] = useState<SortValue>("newest");
  const [minReward, setMinReward] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const debounced = useDebouncedValue(search, 350);

  const { data: reference } = useAsync(async () => {
    const [subjects, categories] = await Promise.all([listSubjects(), listCategories()]);
    return { subjects, categories };
  }, []);

  const sortParams = useMemo(() => {
    switch (sort) {
      case "deadline":
        return { sortBy: "deadline", sortDir: "asc" as const };
      case "reward":
        return { sortBy: "reward", sortDir: "desc" as const };
      case "priority":
        return { sortBy: "priority", sortDir: "desc" as const };
      default:
        return { sortBy: "created_at", sortDir: "desc" as const };
    }
  }, [sort]);

  const { data, loading, error, reload } = useAsync(
    () =>
      listMarketplaceAssignments({
        page,
        pageSize: 9,
        search: debounced,
        subjectId: subjectId || undefined,
        categoryId: categoryId || undefined,
        priority: priority || undefined,
        academicLevel: level || undefined,
        minReward: minReward ? Number(minReward) : undefined,
        ...sortParams,
      }),
    [page, debounced, subjectId, categoryId, priority, level, minReward, sortParams],
  );

  const { data: claimMap, reload: reloadClaims } = useAsync(
    async (): Promise<Record<string, string>> => (user ? getMyClaimMap(user.id) : {}),
    [user?.id],
  );
  const { data: claimCounts, reload: reloadClaimCounts } = useAsync(
    async () => user ? countWriterClaimsByStatus(user.id) : null,
    [user?.id],
  );
  const activeClaims = (claimCounts?.claimed ?? 0) + (claimCounts?.submitted ?? 0) + (claimCounts?.revision ?? 0);
  const atClaimLimit = activeClaims >= 5;

  const handleClaim = async (assignment: Assignment) => {
    setClaimingId(assignment.id);
    try {
      await claimAssignment(assignment.id);
      toast.success("Assignment claimed", `"${assignment.title}" has been added to your assignments.`);
      reload();
      reloadClaims();
      reloadClaimCounts();
    } catch (err) {
      toast.error("Could not claim assignment", err instanceof Error ? err.message : undefined);
    } finally {
      setClaimingId(null);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setSubjectId("");
    setCategoryId("");
    setPriority("");
    setLevel("");
    setMinReward("");
    setPage(1);
  };

  const activeFilterCount = [subjectId, categoryId, priority, level, minReward].filter(Boolean).length;

  return (
    <div className="animate-fade">
      <PageHeader
        title="Browse assignments"
        description="Find work that matches your expertise. New assignments are published regularly."
        actions={
          <>
            <Button variant="outline" icon={SlidersHorizontal} onClick={() => setShowFilters((v) => !v)}>
              Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
            </Button>
            <Button variant="ghost" icon={RefreshCcw} onClick={reload}>
              Refresh
            </Button>
          </>
        }
      />

      <Card flush className="iw-mb-5">
        <div className="iw-toolbar">
          <SearchInput
            className="iw-toolbar__grow"
            placeholder="Search by title, code or keywords…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Segmented
            value={sort}
            onChange={(v) => {
              setSort(v);
              setPage(1);
            }}
            options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
          />
        </div>

        {showFilters && (
          <div className="iw-toolbar" style={{ borderTop: "1px solid var(--color-border)", flexWrap: "wrap", gap: 12 }}>
            <Select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setPage(1);
              }}
              style={{ width: 180 }}
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
            <Select
              value={level}
              onChange={(e) => {
                setLevel(e.target.value);
                setPage(1);
              }}
              style={{ width: 160 }}
            >
              <option value="">All levels</option>
              {ACADEMIC_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
            <Select
              value={minReward}
              onChange={(e) => {
                setMinReward(e.target.value);
                setPage(1);
              }}
              style={{ width: 150 }}
            >
              <option value="">Any reward</option>
              <option value="25">$25+</option>
              <option value="50">$50+</option>
              <option value="100">$100+</option>
              <option value="250">$250+</option>
            </Select>
            <div className="iw-inline iw-gap-2">
              {PRIORITY_OPTIONS.map((p) => (
                <Chip
                  key={p}
                  active={priority === p}
                  onClick={() => {
                    setPriority(priority === p ? "" : p);
                    setPage(1);
                  }}
                >
                  {p}
                </Chip>
              ))}
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" icon={Filter} onClick={resetFilters}>
                Clear filters
              </Button>
            )}
          </div>
        )}
      </Card>

      {loading ? (
        <div className="iw-grid iw-grid--cards">
          {Array.from({ length: 6 }).map((_, i) => (
            <AssignmentCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : !data || data.rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Sparkles}
            title="No assignments match your filters"
            description="Try broadening your search or clearing filters. New work is added often."
            action={
              activeFilterCount > 0 ? (
                <Button variant="outline" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <div className="iw-between iw-mb-4">
            <span className="text-sm text-secondary">
              {data.count} assignment{data.count === 1 ? "" : "s"} available · {activeClaims}/5 active claims
            </span>
            <span className="iw-inline iw-gap-2 text-xs text-muted">
              <Award size={13} /> Claimed work appears under “My assignments”
            </span>
          </div>

          <div className="iw-grid iw-grid--cards">
            {data.rows.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                claimId={claimMap?.[assignment.id] ?? null}
                onView={() => navigate(`/writer/assignments/${assignment.id}`)}
                onClaim={() => void handleClaim(assignment)}
                claiming={claimingId === assignment.id}
                claimDisabled={atClaimLimit}
              />
            ))}
          </div>

          <div className="iw-mt-5">
            <Pagination page={page} pageSize={data.pageSize} total={data.count} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}
