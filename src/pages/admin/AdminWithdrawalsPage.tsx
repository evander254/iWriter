import { useState } from "react";
import { Banknote, CheckCircle2, Clock, Eye, Wallet, XCircle } from "lucide-react";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Loading,
  Modal,
  Money,
  PageHeader,
  Pagination,
  StatCard,
  Table,
  Td,
  Textarea,
  Th,
} from "../../components/common";
import { StatusBadge } from "../../components/common/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../contexts/ToastContext";
import { getFinanceSummary, listWithdrawals, processWithdrawal } from "../../services";
import { displayName } from "../../types";
import type { WithdrawalRequest, WithdrawalStatus } from "../../types/models";
import { formatCurrency, formatNumber } from "../../utils/format";
import { formatDateTime, formatRelative } from "../../utils/date";

const STATUS_TABS: Array<{ value: WithdrawalStatus | "all"; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

export function AdminWithdrawalsPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<WithdrawalStatus | "all">("pending");
  const [target, setTarget] = useState<WithdrawalRequest | null>(null);
  const [action, setAction] = useState<"approved" | "rejected" | "paid">("approved");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: summary } = useAsync(() => getFinanceSummary(), []);

  const { data, loading, error, reload } = useAsync(
    () => listWithdrawals({ page, pageSize: 12, status: status === "all" ? undefined : status }),
    [page, status],
  );

  const open = (request: WithdrawalRequest, next: "approved" | "rejected" | "paid") => {
    setTarget(request);
    setAction(next);
    setNotes("");
  };

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await processWithdrawal(target.id, action, notes.trim());
      toast.success(
        action === "approved" ? "Withdrawal approved" : action === "paid" ? "Withdrawal marked paid" : "Withdrawal rejected",
        action === "rejected" ? "Funds have been returned to the writer's balance." : undefined,
      );
      setTarget(null);
      reload();
    } catch (err) {
      toast.error("Could not process withdrawal", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader
        title="Withdrawals"
        description="Review and process writer payout requests. Funds are reserved when a request is made."
      />

      <div className="iw-grid iw-grid--stats iw-mb-5">
        <StatCard label="Pending" value={formatCurrency(summary?.pendingWithdrawals)} icon={Clock} tone="warning" foot={`${summary?.pendingWithdrawalCount ?? 0} requests`} />
        <StatCard label="Approved" value={formatCurrency(summary?.approvedWithdrawals)} icon={CheckCircle2} tone="info" foot="awaiting payment" />
        <StatCard label="Paid" value={formatCurrency(summary?.paidWithdrawals)} icon={Banknote} tone="success" foot="completed" />
        <StatCard label="Rejected" value={formatCurrency(summary?.rejectedWithdrawals)} icon={XCircle} tone="danger" foot="refunded" />
      </div>

      <Card flush>
        <div className="iw-toolbar">
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
          <div className="spacer" />
          <Badge tone="neutral">{formatNumber(data?.count ?? 0)} requests</Badge>
        </div>

        {loading ? (
          <Loading label="Loading withdrawals…" />
        ) : error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : !data || data.rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={status === "pending" ? "No pending withdrawals" : "No withdrawal requests"}
            description={status === "pending" ? "All payout requests have been processed." : "Requests will appear here as writers submit them."}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Writer</Th>
                  <Th>Method</Th>
                  <Th>Account</Th>
                  <Th>Requested</Th>
                  <Th>Processed</Th>
                  <Th numeric>Amount</Th>
                  <Th>Status</Th>
                  <Th className="iw-table__num">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((request) => (
                  <tr key={request.id}>
                    <Td>
                      <div className="iw-inline iw-gap-3">
                        <Avatar name={displayName(request.writer)} src={request.writer?.avatar_url} size="sm" />
                        <div style={{ minWidth: 0 }}>
                          <div className="iw-table__primary truncate" style={{ maxWidth: 160 }}>
                            {request.writer?.full_name ?? "Writer"}
                          </div>
                          <div className="iw-table__sub truncate" style={{ maxWidth: 160 }}>
                            {request.writer?.email}
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <span className="text-sm">{request.method ?? "—"}</span>
                    </Td>
                    <Td>
                      <span className="text-xs mono">{request.account_number ?? "—"}</span>
                    </Td>
                    <Td>
                      <span className="text-sm">{formatRelative(request.requested_at)}</span>
                    </Td>
                    <Td>
                      <span className="text-sm">{request.processed_at ? formatDateTime(request.processed_at) : "—"}</span>
                    </Td>
                    <Td numeric>
                      <Money value={request.amount} />
                    </Td>
                    <Td>
                      <StatusBadge kind="withdrawal" value={request.status} />
                    </Td>
                    <Td>
                      <div className="iw-table__actions">
                        {request.status === "pending" && (
                          <>
                            <Button size="sm" variant="success-soft" icon={CheckCircle2} onClick={() => open(request, "approved")}>
                              Approve
                            </Button>
                            <Button size="sm" variant="danger-soft" icon={XCircle} onClick={() => open(request, "rejected")}>
                              Reject
                            </Button>
                          </>
                        )}
                        {request.status === "approved" && (
                          <Button size="sm" variant="primary" icon={Banknote} onClick={() => open(request, "paid")}>
                            Mark paid
                          </Button>
                        )}
                        {(request.status === "paid" || request.status === "rejected") && (
                          <Button size="sm" variant="ghost" icon={Eye} onClick={() => open(request, request.status === "paid" ? "paid" : "rejected")}>
                            View
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

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={
          action === "approved" ? "Approve withdrawal" : action === "paid" ? "Mark as paid" : "Reject withdrawal"
        }
        description={
          target
            ? `${displayName(target.writer)} requested ${formatCurrency(target.amount)} via ${target.method ?? "—"}.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={busy}>
              Cancel
            </Button>
            {target?.status === "pending" || target?.status === "approved" ? (
              <Button
                variant={action === "rejected" ? "danger" : action === "paid" ? "primary" : "success"}
                loading={busy}
                onClick={submit}
              >
                {action === "approved" ? "Approve request" : action === "paid" ? "Mark as paid" : "Reject & refund"}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setTarget(null)}>
                Close
              </Button>
            )}
          </>
        }
      >
        <div className="stack iw-gap-4">
          {action === "rejected" && (
            <Alert tone="warning" title="Funds will be returned">
              Rejecting returns {target ? formatCurrency(target.amount) : "the amount"} to the writer's available balance immediately.
            </Alert>
          )}
          {action === "paid" && (
            <Alert tone="success" title="Confirm the transfer">
              Only mark as paid once the funds have actually been sent.
            </Alert>
          )}

          <div className="iw-between iw-p-3" style={{ background: "var(--color-bg-subtle)", borderRadius: 12 }}>
            <span className="text-sm text-secondary">Amount</span>
            <strong>{formatCurrency(target?.amount ?? 0)}</strong>
          </div>

          <div className="iw-between">
            <span className="text-sm text-secondary">Destination</span>
            <span className="text-sm mono">{target?.account_number ?? "—"}</span>
          </div>

          <Textarea
            rows={3}
            placeholder="Add a note for the writer (optional)…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {target?.admin_notes && (
            <div className="text-xs text-muted">Previous note: {target.admin_notes}</div>
          )}
        </div>
      </Modal>
    </div>
  );
}
