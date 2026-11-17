import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Ban,
  Briefcase,
  CheckCircle2,
  Coins,
  FileCheck2,
  Mail,
  MapPin,
  Phone,
  Wallet,
} from "lucide-react";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  DescriptionList,
  EmptyState,
  ErrorState,
  Loading,
  Money,
  PageHeader,
  Progress,
  StatCard,
  Table,
  Tabs,
  Td,
  Th,
  Timeline,
} from "../../components/common";
import { StatusBadge } from "../../components/common/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../contexts/ToastContext";
import {
  getWriterSummary,
  listRecentHistory,
  listTransactions,
  listWithdrawals,
  listWriterClaims,
  listWriterSubmissions,
  setWriterStatus,
} from "../../services";
import { displayName } from "../../types";
import { formatDate, formatRelative } from "../../utils/date";
import { formatCurrency, formatNumber } from "../../utils/format";

export function AdminWriterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState("claims");
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    if (!id) return null;
    const [summary, claims, submissions, transactions, withdrawals, history] = await Promise.all([
      getWriterSummary(id),
      listWriterClaims(id, { pageSize: 50 }),
      listWriterSubmissions(id, { pageSize: 50 }),
      listTransactions({ userId: id, pageSize: 50 }),
      listWithdrawals({ userId: id, pageSize: 50 }),
      listRecentHistory(50),
    ]);
    return { summary, claims, submissions, transactions, withdrawals, history: history.filter((h) => h.user_id === id) };
  }, [id]);

  if (loading) return <Loading full label="Loading writer…" />;
  if (error || !data || !data.summary) {
    return <ErrorState title="Writer not found" description={error ?? "This writer could not be loaded."} onRetry={reload} />;
  }

  const { summary, claims, submissions, transactions, withdrawals, history } = data;
  const { profile } = summary;
  const completion = summary.totalClaims > 0 ? (summary.approvedClaims / summary.totalClaims) * 100 : 0;

  const toggleStatus = async () => {
    setBusy(true);
    try {
      const next = profile.status === "suspended" ? "active" : "suspended";
      await setWriterStatus(profile.id, next);
      toast.success(next === "suspended" ? "Writer suspended" : "Writer reactivated");
      setConfirmStatus(false);
      reload();
    } catch (err) {
      toast.error("Could not update status", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader
        title={profile.full_name || "Unnamed writer"}
        description={profile.email ?? "Writer account"}
        actions={
          <>
            <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate("/admin/writers")}>
              Back
            </Button>
            {profile.status === "suspended" ? (
              <Button variant="success" icon={CheckCircle2} onClick={() => setConfirmStatus(true)}>
                Reactivate
              </Button>
            ) : (
              <Button variant="danger-soft" icon={Ban} onClick={() => setConfirmStatus(true)}>
                Suspend
              </Button>
            )}
          </>
        }
      />

      {profile.status === "suspended" && (
        <Alert tone="warning" title="This account is suspended" className="iw-mb-5">
          The writer cannot claim or submit assignments until reactivated.
        </Alert>
      )}

      <div className="iw-grid iw-grid--2-1">
        <Card flush>
          <CardHeader title="Account overview" subtitle="Identity and contact details" />
          <div className="iw-card__body stack iw-gap-5">
            <div className="iw-inline iw-gap-4">
              <Avatar name={displayName(profile)} src={profile.avatar_url} size="xl" />
              <div>
                <div style={{ fontSize: 18, fontWeight: 650 }}>{profile.full_name || "Unnamed writer"}</div>
                <div className="text-sm text-secondary">{profile.email}</div>
                <div className="iw-inline iw-gap-2 iw-mt-2">
                  <StatusBadge kind="account" value={profile.status} />
                  <Badge tone="accent">{profile.role}</Badge>
                </div>
              </div>
            </div>

            {profile.bio && <p className="text-sm text-secondary">{profile.bio}</p>}

            <DescriptionList
              items={[
                { label: "Email", value: <span className="iw-inline iw-gap-2"><Mail size={14} /> {profile.email ?? "—"}</span> },
                { label: "Phone", value: <span className="iw-inline iw-gap-2"><Phone size={14} /> {profile.phone ?? "—"}</span> },
                { label: "Country", value: <span className="iw-inline iw-gap-2"><MapPin size={14} /> {profile.country ?? "—"}</span> },
                { label: "Joined", value: formatDate(profile.created_at) },
                { label: "Last updated", value: formatDate(profile.updated_at) },
              ]}
            />
          </div>
        </Card>

        <div className="stack iw-gap-5">
          <div className="iw-grid iw-grid--halves">
            <StatCard label="Available balance" value={formatCurrency(profile.available_balance)} icon={Wallet} tone="accent" />
            <StatCard label="Lifetime earnings" value={formatCurrency(profile.total_earnings)} icon={Coins} tone="success" />
            <StatCard label="Active claims" value={summary.activeClaims} icon={Briefcase} tone="warning" />
            <StatCard label="Submissions" value={summary.submissions} icon={FileCheck2} tone="info" />
          </div>

          <Card flush>
            <CardHeader title="Completion rate" subtitle={`${summary.approvedClaims} of ${summary.totalClaims} claims approved`} />
            <div className="iw-card__body">
              <Progress value={completion} tone="success" size="lg" />
              <div className="iw-between iw-mt-2">
                <span className="text-xs text-muted">0%</span>
                <span className="text-sm font-medium">{Math.round(completion)}%</span>
                <span className="text-xs text-muted">100%</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card className="iw-mt-5" flush>
        <div className="iw-tabs">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "claims", label: "Claims", count: claims.count },
              { value: "submissions", label: "Submissions", count: submissions.count },
              { value: "transactions", label: "Transactions", count: transactions.count },
              { value: "withdrawals", label: "Withdrawals", count: withdrawals.count },
              { value: "history", label: "History", count: history.length },
            ]}
          />
        </div>

        {tab === "claims" &&
          (claims.rows.length === 0 ? (
            <EmptyState icon={Briefcase} title="No claims yet" compact />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Assignment</Th>
                  <Th>Reward</Th>
                  <Th>Claimed</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {claims.rows.map((claim) => (
                  <tr key={claim.id}>
                    <Td>
                      <div className="iw-table__primary truncate" style={{ maxWidth: 320 }}>
                        {claim.assignment?.title ?? "Assignment"}
                      </div>
                      <div className="iw-table__sub mono">{claim.assignment?.assignment_code ?? "—"}</div>
                    </Td>
                    <Td>
                      <Money value={claim.assignment?.reward} />
                    </Td>
                    <Td>{formatDate(claim.claimed_at)}</Td>
                    <Td>
                      <StatusBadge kind="claim" value={claim.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ))}

        {tab === "submissions" &&
          (submissions.rows.length === 0 ? (
            <EmptyState icon={FileCheck2} title="No submissions yet" compact />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Assignment</Th>
                  <Th>Submitted</Th>
                  <Th>Files</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {submissions.rows.map((submission) => (
                  <tr key={submission.id}>
                    <Td>
                      <div className="iw-table__primary truncate" style={{ maxWidth: 320 }}>
                        {submission.claim?.assignment?.title ?? "Submission"}
                      </div>
                      <div className="iw-table__sub">{submission.notes ? submission.notes.slice(0, 60) : "—"}</div>
                    </Td>
                    <Td>{formatDate(submission.submitted_at)}</Td>
                    <Td>{submission.files?.length ?? 0}</Td>
                    <Td>
                      <StatusBadge kind="submission" value={submission.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ))}

        {tab === "transactions" &&
          (transactions.rows.length === 0 ? (
            <EmptyState icon={Coins} title="No transactions yet" compact />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Description</Th>
                  <Th>Type</Th>
                  <Th>Date</Th>
                  <Th numeric>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {transactions.rows.map((tx) => (
                  <tr key={tx.id}>
                    <Td>
                      <span className="iw-table__primary">{tx.description ?? "Transaction"}</span>
                    </Td>
                    <Td>
                      <Badge tone="neutral">{tx.transaction_type ?? "—"}</Badge>
                    </Td>
                    <Td>{formatDate(tx.created_at)}</Td>
                    <Td numeric>
                      <Money value={tx.amount} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ))}

        {tab === "withdrawals" &&
          (withdrawals.rows.length === 0 ? (
            <EmptyState icon={Wallet} title="No withdrawal requests" compact />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Method</Th>
                  <Th>Requested</Th>
                  <Th>Processed</Th>
                  <Th>Status</Th>
                  <Th numeric>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.rows.map((request) => (
                  <tr key={request.id}>
                    <Td>
                      <span className="iw-table__primary">{request.method ?? "—"}</span>
                      <div className="iw-table__sub">{request.account_number ?? "—"}</div>
                    </Td>
                    <Td>{formatDate(request.requested_at)}</Td>
                    <Td>{formatDate(request.processed_at)}</Td>
                    <Td>
                      <StatusBadge kind="withdrawal" value={request.status} />
                    </Td>
                    <Td numeric>
                      <Money value={request.amount} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ))}

        {tab === "history" &&
          (history.length === 0 ? (
            <EmptyState icon={Briefcase} title="No history recorded" compact />
          ) : (
            <div className="iw-card__body">
              <Timeline
                items={history.map((entry) => ({
                  title: `${entry.assignment?.title ?? "Assignment"} — ${entry.new_status ?? "updated"}`,
                  meta: entry.remarks ?? undefined,
                  time: entry.created_at,
                }))}
              />
            </div>
          ))}
      </Card>

      <ConfirmDialog
        open={confirmStatus}
        onClose={() => setConfirmStatus(false)}
        onConfirm={toggleStatus}
        loading={busy}
        tone={profile.status === "suspended" ? "success" : "danger"}
        title={profile.status === "suspended" ? "Reactivate writer?" : "Suspend writer?"}
        description={
          profile.status === "suspended"
            ? `${displayName(profile)} will regain full access.`
            : `${displayName(profile)} will be blocked from claiming and submitting work.`
        }
        confirmLabel={profile.status === "suspended" ? "Reactivate" : "Suspend"}
      />

      <p className="text-xs text-muted iw-mt-4">
        Showing {formatNumber(summary.totalClaims)} claims · {formatNumber(summary.submissions)} submissions · last activity{" "}
        {formatRelative(profile.updated_at ?? profile.created_at)}
      </p>
    </div>
  );
}
