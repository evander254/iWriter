import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Ban, CheckCircle2, Coins, Eye, MoreHorizontal, Users, Wallet } from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  Dropdown,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Input,
  Loading,
  Modal,
  Money,
  PageHeader,
  Pagination,
  SearchInput,
  SortHeader,
  Table,
  Td,
  Textarea,
  Th,
} from "../../components/common";
import { StatusBadge } from "../../components/common/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { useDebouncedValue } from "../../hooks/useUi";
import { useToast } from "../../contexts/ToastContext";
import { adjustBalance, listWriters, setWriterStatus } from "../../services";
import { supabase } from "../../lib/supabase";
import { displayName } from "../../types";
import type { AccountStatus, Profile } from "../../types";
import { formatDate } from "../../utils/date";
import { formatCurrency } from "../../utils/format";

const adjustSchema = z.object({
  amount: z.coerce.number().refine((v) => v !== 0, "Enter a non-zero amount"),
  reason: z.string().min(3, "Explain the adjustment").max(200),
});
type AdjustValues = z.infer<typeof adjustSchema>;

export function AdminWritersPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AccountStatus | "all">("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [statusTarget, setStatusTarget] = useState<Profile | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);

  const debounced = useDebouncedValue(search, 350);

  const { data, loading, error, reload } = useAsync(
    () =>
      listWriters({
        page,
        pageSize: 12,
        search: debounced,
        status: status === "all" ? undefined : status,
        sortBy,
        sortDir,
      }),
    [page, debounced, status, sortBy, sortDir],
  );

  const { data: stats, reload: reloadStats } = useAsync(async () => {
    const [claims] = await Promise.all([
      supabase.from("assignment_claims").select("writer_id, status"),
    ]);
    const claimCounts = new Map<string, number>();
    const activeCounts = new Map<string, number>();
    for (const row of claims.data ?? []) {
      if (!row.writer_id) continue;
      claimCounts.set(row.writer_id, (claimCounts.get(row.writer_id) ?? 0) + 1);
      if (["claimed", "submitted", "revision"].includes(String(row.status))) {
        activeCounts.set(row.writer_id, (activeCounts.get(row.writer_id) ?? 0) + 1);
      }
    }
    return { claimCounts, activeCounts };
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof adjustSchema>, unknown, z.output<typeof adjustSchema>>({ resolver: zodResolver(adjustSchema), defaultValues: { amount: 0, reason: "" } });

  const handleSort = (field: string) => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(field);
      setSortDir("desc");
    }
  };

  const toggleStatus = async () => {
    if (!statusTarget) return;
    const next: AccountStatus = statusTarget.status === "suspended" ? "active" : "suspended";
    setBusy(true);
    try {
      await setWriterStatus(statusTarget.id, next);
      toast.success(next === "suspended" ? "Writer suspended" : "Writer reactivated", displayName(statusTarget));
      setStatusTarget(null);
      reload();
    } catch (err) {
      toast.error("Could not update status", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const submitAdjust = async (values: AdjustValues) => {
    if (!adjustTarget) return;
    setBusy(true);
    try {
      await adjustBalance(adjustTarget.id, values.amount, values.reason);
      toast.success("Balance adjusted", `${formatCurrency(values.amount)} applied to ${displayName(adjustTarget)}.`);
      setAdjustTarget(null);
      reset({ amount: 0, reason: "" });
      reload();
    } catch (err) {
      toast.error("Could not adjust balance", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  void reloadStats;

  return (
    <div className="animate-fade">
      <PageHeader title="Writers" description="Manage writer accounts, balances and access to the marketplace." />

      <Card flush>
        <div className="iw-toolbar">
          <SearchInput
            className="iw-toolbar__grow"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <div className="iw-filters">
            {(["all", "active", "suspended", "inactive"] as const).map((value) => (
              <Chip
                key={value}
                active={status === value}
                onClick={() => {
                  setStatus(value);
                  setPage(1);
                }}
              >
                {value === "all" ? "All" : value.charAt(0).toUpperCase() + value.slice(1)}
              </Chip>
            ))}
          </div>
        </div>

        {loading ? (
          <Loading label="Loading writers…" />
        ) : error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState icon={Users} title="No writers found" description="Try adjusting your search or filters." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <SortHeader label="Writer" field="full_name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <Th numeric>Active</Th>
                  <Th numeric>Total claims</Th>
                  <SortHeader label="Earnings" field="total_earnings" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} numeric />
                  <SortHeader label="Balance" field="available_balance" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} numeric />
                  <Th>Status</Th>
                  <SortHeader label="Joined" field="created_at" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <Th className="iw-table__num">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((writer) => (
                  <tr key={writer.id}>
                    <Td>
                      <div className="iw-inline iw-gap-3">
                        <Avatar name={displayName(writer)} src={writer.avatar_url} />
                        <div style={{ minWidth: 0 }}>
                          <div className="iw-table__primary truncate" style={{ maxWidth: 200 }}>
                            {writer.full_name || "Unnamed writer"}
                          </div>
                          <div className="iw-table__sub truncate" style={{ maxWidth: 200 }}>
                            {writer.email}
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td numeric>{stats?.activeCounts.get(writer.id) ?? 0}</Td>
                    <Td numeric>{stats?.claimCounts.get(writer.id) ?? 0}</Td>
                    <Td numeric>
                      <Money value={writer.total_earnings} />
                    </Td>
                    <Td numeric>
                      <Money value={writer.available_balance} />
                    </Td>
                    <Td>
                      <StatusBadge kind="account" value={writer.status} />
                    </Td>
                    <Td>{formatDate(writer.created_at)}</Td>
                    <Td>
                      <div className="iw-table__actions">
                        <IconButton icon={Eye} label="View writer" size="sm" onClick={() => navigate(`/admin/writers/${writer.id}`)} />
                        <Dropdown
                          trigger={<IconButton icon={MoreHorizontal} label="More actions" size="sm" />}
                          items={[
                            { label: "View profile", icon: Eye, onClick: () => navigate(`/admin/writers/${writer.id}`) },
                            { label: "Adjust balance", icon: Coins, onClick: () => { reset({ amount: 0, reason: "" }); setAdjustTarget(writer); } },
                            "divider",
                            writer.status === "suspended"
                              ? { label: "Reactivate account", icon: CheckCircle2, onClick: () => setStatusTarget(writer) }
                              : { label: "Suspend account", icon: Ban, danger: true, onClick: () => setStatusTarget(writer) },
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
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={toggleStatus}
        loading={busy}
        tone={statusTarget?.status === "suspended" ? "success" : "danger"}
        title={statusTarget?.status === "suspended" ? "Reactivate writer?" : "Suspend writer?"}
        description={
          statusTarget?.status === "suspended"
            ? `${displayName(statusTarget)} will regain access to claim and submit assignments.`
            : `${statusTarget ? displayName(statusTarget) : "This writer"} will be blocked from claiming and submitting work.`
        }
        confirmLabel={statusTarget?.status === "suspended" ? "Reactivate" : "Suspend"}
      />

      <Modal
        open={Boolean(adjustTarget)}
        onClose={() => setAdjustTarget(null)}
        title="Adjust balance"
        description={
          adjustTarget
            ? `Apply a bonus or penalty to ${displayName(adjustTarget)}. Positive values credit, negative values debit.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdjustTarget(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" icon={Coins} loading={busy} onClick={handleSubmit(submitAdjust)}>
              Apply adjustment
            </Button>
          </>
        }
      >
        <div className="stack iw-gap-4">
          <Field label="Amount (USD)" htmlFor="amount" required error={errors.amount?.message} hint="Use a negative value to deduct">
            <Input id="amount" type="number" step="0.01" icon={Wallet} autoFocus {...register("amount")} />
          </Field>
          <Field label="Reason" htmlFor="reason" required error={errors.reason?.message}>
            <Textarea id="reason" rows={3} placeholder="e.g. Performance bonus for Q1" {...register("reason")} />
          </Field>
          {adjustTarget && (
            <div className="iw-between iw-p-3" style={{ background: "var(--color-bg-subtle)", borderRadius: 12 }}>
              <span className="text-sm text-secondary">Current balance</span>
              <Money value={adjustTarget.available_balance} />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
