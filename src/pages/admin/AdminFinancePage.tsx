import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Banknote,
  Coins,
  CreditCard,
  PiggyBank,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Chip,
  EmptyState,
  ErrorState,
  Loading,
  Money,
  PageHeader,
  Pagination,
  Progress,
  Segmented,
  StatCard,
  Table,
  Td,
  Th,
} from "../../components/common";
import { ChartLegend, DonutChart, EarningsAreaChart, SimpleBarChart, CHART_COLORS } from "../../components/dashboard/Charts";
import { useAsync } from "../../hooks/useAsync";
import { getEarningPoints, getFinanceSummary, listTransactions, listWithdrawals } from "../../services";
import { supabase } from "../../lib/supabase";
import { displayName } from "../../types";
import { formatCurrency, formatNumber } from "../../utils/format";
import { formatRelative } from "../../utils/date";
import { buildTimeSeries, RANGE_OPTIONS, rangeStart, type RangePreset } from "../../utils/charts";

export function AdminFinancePage() {
  const navigate = useNavigate();
  const [range, setRange] = useState<RangePreset>("30d");
  const [type, setType] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data: summary, loading: summaryLoading } = useAsync(() => getFinanceSummary(), []);
  const { data: earnings } = useAsync(() => getEarningPoints(), []);

  const { data: tx, loading: txLoading, error: txError, reload } = useAsync(
    () => listTransactions({ page, pageSize: 12, type: type === "all" ? undefined : type }),
    [page, type],
  );

  const { data: topWriters } = useAsync(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url, total_earnings, available_balance")
      .eq("role", "writer")
      .order("total_earnings", { ascending: false })
      .limit(6);
    return data ?? [];
  }, []);

  const { data: withdrawals } = useAsync(async () => {
    const result = await listWithdrawals({ pageSize: 200 });
    const byStatus = { pending: 0, approved: 0, paid: 0, rejected: 0 } as Record<string, number>;
    for (const row of result.rows) {
      byStatus[String(row.status)] = (byStatus[String(row.status)] ?? 0) + Number(row.amount ?? 0);
    }
    return byStatus;
  }, []);

  const series = useMemo(() => {
    if (!earnings) return [];
    const start = rangeStart(range);
    return buildTimeSeries(earnings.filter((p) => new Date(p.created_at) >= start), range);
  }, [earnings, range]);

  const rangeTotal = series.reduce((sum, p) => sum + p.value, 0);

  const donut = withdrawals
    ? [
        { name: "Paid", value: withdrawals.paid, color: CHART_COLORS.success },
        { name: "Approved", value: withdrawals.approved, color: CHART_COLORS.info },
        { name: "Pending", value: withdrawals.pending, color: CHART_COLORS.warning },
        { name: "Rejected", value: withdrawals.rejected, color: CHART_COLORS.danger },
      ].filter((d) => d.value > 0)
    : [];

  const txTypeTabs = [
    { value: "all", label: "All" },
    { value: "earning", label: "Earnings" },
    { value: "withdrawal", label: "Withdrawals" },
    { value: "bonus", label: "Bonuses" },
    { value: "penalty", label: "Penalties" },
    { value: "adjustment", label: "Adjustments" },
  ];

  const topWriterChart = (topWriters ?? []).map((w) => ({
    label: (w.full_name ?? w.email ?? "Writer").split(" ")[0],
    value: Number(w.total_earnings ?? 0),
  }));

  return (
    <div className="animate-fade">
      <PageHeader
        title="Financial management"
        description="Track writer earnings, balances and withdrawal flow across the platform."
        actions={
          <>
            <Segmented value={range} onChange={setRange} options={RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label.replace("Last ", "") }))} />
            <Button variant="primary" icon={Wallet} onClick={() => navigate("/admin/withdrawals")}>
              Process withdrawals
            </Button>
          </>
        }
      />

      <div className="iw-grid iw-grid--stats">
        <StatCard label="Total earnings credited" value={summaryLoading ? "…" : formatCurrency(summary?.totalEarnings)} icon={Coins} tone="success" foot="lifetime" />
        <StatCard label="Writer balances" value={summaryLoading ? "…" : formatCurrency(summary?.totalAvailableBalances)} icon={PiggyBank} tone="accent" foot="held in wallets" />
        <StatCard label="Paid out" value={summaryLoading ? "…" : formatCurrency(summary?.paidWithdrawals)} icon={Banknote} tone="accent" foot="completed" />
        <StatCard label="Pending withdrawals" value={summaryLoading ? "…" : formatCurrency(summary?.pendingWithdrawals)} icon={Wallet} tone="warning" foot={`${summary?.pendingWithdrawalCount ?? 0} requests`} />
      </div>

      <div className="iw-grid iw-grid--2-1 iw-mt-5">
        <Card flush>
          <CardHeader title="Earnings credited" subtitle={`${formatCurrency(rangeTotal)} in the selected period`} />
          <div className="iw-chart-card__body">
            {series.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No earnings in this period" compact />
            ) : (
              <EarningsAreaChart data={series} series={[{ key: "value", name: "Earnings", color: CHART_COLORS.accent }]} />
            )}
          </div>
        </Card>

        <Card flush>
          <CardHeader title="Withdrawal flow" subtitle="Totals by status" />
          <div className="iw-card__body">
            {donut.length === 0 ? (
              <EmptyState icon={Wallet} title="No withdrawals yet" compact />
            ) : (
              <>
                <DonutChart data={donut} centerValue={formatCurrency((summary?.paidWithdrawals ?? 0) + (summary?.approvedWithdrawals ?? 0))} centerLabel="approved + paid" />
                <div className="iw-mt-4">
                  <ChartLegend items={donut.map((d) => ({ name: d.name, value: formatCurrency(d.value), color: d.color! }))} />
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      <div className="iw-grid iw-grid--2-1 iw-mt-5">
        <Card flush>
          <CardHeader title="Top earning writers" subtitle="Lifetime earnings" />
          <div className="iw-chart-card__body">
            {topWriterChart.length === 0 ? (
              <EmptyState icon={Coins} title="No earnings yet" compact />
            ) : (
              <SimpleBarChart data={topWriterChart} series={[{ key: "value", name: "Earnings", color: CHART_COLORS.accent }]} currency />
            )}
          </div>
        </Card>

        <Card flush>
          <CardHeader title="Top writers" subtitle="Highest lifetime earnings" />
          {!topWriters || topWriters.length === 0 ? (
            <EmptyState icon={Coins} title="No writers yet" compact />
          ) : (
            <ul>
              {topWriters.map((writer, index) => (
                <li key={writer.id} className="iw-notif" style={{ cursor: "default" }}>
                  <span className="iw-rank">{index + 1}</span>
                  <Avatar name={writer.full_name ?? writer.email} src={writer.avatar_url} size="sm" />
                  <div className="iw-notif__body">
                    <div className="iw-notif__title truncate">{writer.full_name ?? writer.email ?? "Writer"}</div>
                    <div className="iw-notif__text">Balance {formatCurrency(writer.available_balance)}</div>
                  </div>
                  <Money value={writer.total_earnings} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="iw-mt-5" flush>
        <CardHeader title="Transaction ledger" subtitle="Every credit and debit across writer wallets" />
        <div className="iw-toolbar">
          <div className="iw-filters">
            {txTypeTabs.map((tab) => (
              <Chip
                key={tab.value}
                active={type === tab.value}
                onClick={() => {
                  setType(tab.value);
                  setPage(1);
                }}
              >
                {tab.label}
              </Chip>
            ))}
          </div>
          <div className="spacer" />
          <Badge tone="neutral">{formatNumber(tx?.count ?? 0)} entries</Badge>
        </div>

        {txLoading ? (
          <Loading label="Loading transactions…" />
        ) : txError ? (
          <ErrorState description={txError} onRetry={reload} />
        ) : !tx || tx.rows.length === 0 ? (
          <EmptyState icon={CreditCard} title="No transactions found" />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Writer</Th>
                  <Th>Description</Th>
                  <Th>Type</Th>
                  <Th>Reference</Th>
                  <Th>Date</Th>
                  <Th numeric>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {tx.rows.map((entry) => (
                  <tr key={entry.id}>
                    <Td>
                      <div className="iw-inline iw-gap-3">
                        <Avatar name={displayName(entry.writer)} src={entry.writer?.avatar_url} size="sm" />
                        <span className="text-sm truncate" style={{ maxWidth: 160 }}>
                          {entry.writer?.full_name ?? entry.writer?.email ?? "—"}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <span className="text-sm">{entry.description ?? "—"}</span>
                    </Td>
                    <Td>
                      <Badge tone="neutral">{entry.transaction_type ?? "—"}</Badge>
                    </Td>
                    <Td>
                      <span className="text-xs mono text-muted">{entry.reference ? entry.reference.slice(0, 12) : "—"}</span>
                    </Td>
                    <Td>
                      <span className="text-sm">{formatRelative(entry.created_at)}</span>
                    </Td>
                    <Td numeric>
                      <Money value={entry.amount} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={tx.pageSize} total={tx.count} onPageChange={setPage} />
          </>
        )}
      </Card>

      <div className="iw-grid iw-grid--halves iw-mt-5">
        <Card flush>
          <CardHeader title="Balance health" subtitle="Credited vs. held vs. paid out" />
          <div className="iw-card__body stack iw-gap-4">
            <div>
              <div className="iw-between iw-mb-2">
                <span className="text-sm text-secondary">Lifetime credited</span>
                <Money value={summary?.totalEarnings} />
              </div>
              <Progress value={100} tone="success" />
            </div>
            <div>
              <div className="iw-between iw-mb-2">
                <span className="text-sm text-secondary">Currently in wallets</span>
                <Money value={summary?.totalAvailableBalances} />
              </div>
              <Progress
                value={summary?.totalEarnings ? ((summary.totalAvailableBalances / summary.totalEarnings) * 100) : 0}
                tone="accent"
              />
            </div>
            <div>
              <div className="iw-between iw-mb-2">
                <span className="text-sm text-secondary">Withdrawn</span>
                <Money value={(summary?.paidWithdrawals ?? 0) + (summary?.approvedWithdrawals ?? 0)} />
              </div>
              <Progress
                value={summary?.totalEarnings ? (((summary.paidWithdrawals + summary.approvedWithdrawals) / summary.totalEarnings) * 100) : 0}
                tone="accent"
              />
            </div>
          </div>
        </Card>

        <Card flush>
          <CardHeader title="Withdrawal summary" subtitle="Request totals" />
          <div className="iw-card__body">
            <Table compact>
              <tbody>
                <tr>
                  <Td>Pending</Td>
                  <Td numeric>
                    <Money value={withdrawals?.pending} />
                  </Td>
                </tr>
                <tr>
                  <Td>Approved</Td>
                  <Td numeric>
                    <Money value={withdrawals?.approved} />
                  </Td>
                </tr>
                <tr>
                  <Td>Paid</Td>
                  <Td numeric>
                    <Money value={withdrawals?.paid} />
                  </Td>
                </tr>
                <tr>
                  <Td>Rejected</Td>
                  <Td numeric>
                    <Money value={withdrawals?.rejected} />
                  </Td>
                </tr>
              </tbody>
            </Table>
            <div className="iw-mt-4">
              <Button variant="outline" icon={Wallet} block onClick={() => navigate("/admin/withdrawals")}>
                Manage withdrawals
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
