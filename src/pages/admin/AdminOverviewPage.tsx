import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FileClock,
  RefreshCcw,
  Users,
  Wallet,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Loading,
  Money,
  PageHeader,
  Progress,
  Segmented,
  StatCard,
  Timeline,
} from "../../components/common";
import { StatusBadge } from "../../components/common/StatusBadge";
import { ChartLegend, DonutChart, EarningsAreaChart, SimpleBarChart, CHART_COLORS } from "../../components/dashboard/Charts";
import { useAsync } from "../../hooks/useAsync";
import {
  getAdminStats,
  getAssignmentStatusCounts,
  getEarningPoints,
  listActivityLogs,
  listAllClaims,
  listAllSubmissions,
  listPendingWithdrawals,
  listRecentRegistrations,
  getPlatformActivitySeries,
} from "../../services";
import { formatCurrency, formatNumber } from "../../utils/format";
import { formatRelative, formatDate } from "../../utils/date";
import { buildTimeSeries, RANGE_OPTIONS, rangeStart, type RangePreset } from "../../utils/charts";
import { assignmentStatusMeta } from "../../lib/status";

export function AdminOverviewPage() {
  const [range, setRange] = useState<RangePreset>("30d");

  const { data, loading, error, reload } = useAsync(
    async () => {
      const [stats, statusCounts, earnings, recentWriters, recentClaims, recentSubmissions, pendingWithdrawals, activity, platformSeries] =
        await Promise.all([
          getAdminStats(),
          getAssignmentStatusCounts(),
          getEarningPoints(),
          listRecentRegistrations(6),
          listAllClaims({ pageSize: 5 }),
          listAllSubmissions({ pageSize: 5, status: ["pending", "revision"] }),
          listPendingWithdrawals(5),
          listActivityLogs(8),
          getPlatformActivitySeries(),
        ]);
      return { stats, statusCounts, earnings, recentWriters, recentClaims, recentSubmissions, pendingWithdrawals, activity, platformSeries };
    },
    [],
  );

  if (loading) return <Loading full label="Loading your dashboard…" />;
  if (error || !data) return <ErrorState description={error ?? "Unable to load dashboard data."} onRetry={reload} />;

  const { stats, statusCounts, earnings, recentWriters, recentClaims, recentSubmissions, pendingWithdrawals, activity, platformSeries } = data;

  const start = rangeStart(range);
  const filteredEarnings = earnings.filter((p) => new Date(p.created_at) >= start);
  const earningsSeries = buildTimeSeries(filteredEarnings, range);
  const totalInRange = filteredEarnings.reduce((sum, p) => sum + p.amount, 0);

  const platformSeriesFiltered = platformSeries
    .filter((p) => new Date(`${p.month}-01`) >= start)
    .map((p) => ({ label: p.month.slice(5), Assignments: p.assignments, Claims: p.claims }));

  const statusDonut = (Object.keys(statusCounts) as Array<keyof typeof statusCounts>)
    .map((key) => ({ name: assignmentStatusMeta(key).label, value: statusCounts[key] }))
    .filter((d) => d.value > 0);

  const pendingTasks = [
    { label: "Submissions awaiting review", value: stats.pendingSubmissions, to: "/admin/submissions", icon: FileCheck2, tone: "warning" as const },
    { label: "Revisions requested", value: stats.pendingRevisions, to: "/admin/revisions", icon: RefreshCcw, tone: "info" as const },
    { label: "Withdrawals to process", value: stats.pendingWithdrawals, to: "/admin/withdrawals", icon: Wallet, tone: "danger" as const },
  ];

  return (
    <div className="animate-fade">
      <PageHeader
        title="Platform overview"
        description="A live snapshot of writers, assignments, submissions and finances across iWriter."
        actions={
          <>
            <Segmented
              value={range}
              onChange={(v) => setRange(v)}
              options={RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label.replace("Last ", "") }))}
            />
            <Button variant="outline" icon={RefreshCcw} onClick={reload}>
              Refresh
            </Button>
          </>
        }
      />

      <div className="iw-grid iw-grid--stats">
        <StatCard label="Total writers" value={formatNumber(stats.totalWriters)} icon={Users} tone="accent" foot={`${stats.activeWriters} active`} />
        <StatCard label="Suspended" value={formatNumber(stats.suspendedWriters)} icon={AlertTriangle} tone="danger" foot="accounts paused" />
        <StatCard label="Total assignments" value={formatNumber(stats.totalAssignments)} icon={ClipboardList} tone="info" foot={`${stats.availableAssignments} available`} />
        <StatCard label="Claimed / active" value={formatNumber(stats.claimedAssignments)} icon={Briefcase} tone="warning" foot="in progress" />
        <StatCard label="Completed" value={formatNumber(stats.completedAssignments)} icon={CheckCircle2} tone="success" foot="approved & done" />
        <StatCard label="Pending submissions" value={formatNumber(stats.pendingSubmissions)} icon={FileCheck2} tone="warning" foot="awaiting review" />
        <StatCard label="Pending revisions" value={formatNumber(stats.pendingRevisions)} icon={FileClock} tone="info" foot="awaiting rewrite" />
        <StatCard label="Writer earnings" value={formatCurrency(stats.totalWriterEarnings)} icon={CreditCard} tone="success" foot="lifetime" />
        <StatCard label="Withdrawals paid" value={formatCurrency(stats.totalWithdrawals)} icon={Wallet} tone="accent" foot="approved & paid" />
        <StatCard label="Pending withdrawals" value={formatNumber(stats.pendingWithdrawals)} icon={Wallet} tone="danger" foot="to process" />
      </div>

      <div className="iw-grid iw-grid--2-1 iw-mt-5">
        <Card flush>
          <CardHeader
            title="Earnings credited"
            subtitle={`${formatCurrency(totalInRange)} credited in the selected period`}
            actions={<Badge tone="success">{filteredEarnings.length} transactions</Badge>}
          />
          <div className="iw-chart-card__body">
            <EarningsAreaChart
              data={earningsSeries}
              series={[{ key: "value", name: "Earnings", color: CHART_COLORS.accent }]}
            />
          </div>
        </Card>

        <Card flush>
          <CardHeader title="Assignments by status" subtitle="Distribution across the pipeline" />
          <div className="iw-card__body">
            {statusDonut.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No assignments yet" description="Create your first assignment to see the pipeline." compact />
            ) : (
              <>
                <DonutChart
                  data={statusDonut}
                  centerValue={formatNumber(stats.totalAssignments)}
                  centerLabel="assignments"
                />
                <div className="iw-mt-4">
                  <ChartLegend
                    items={statusDonut.slice(0, 5).map((d, i) => ({
                      name: d.name,
                      value: d.value,
                      color: [CHART_COLORS.accent, CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.info, CHART_COLORS.danger][i],
                    }))}
                  />
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      <div className="iw-grid iw-grid--2-1 iw-mt-5">
        <Card flush>
          <CardHeader title="Assignment & claim activity" subtitle="New assignments published vs. claims made" />
          <div className="iw-chart-card__body">
            {platformSeriesFiltered.length === 0 ? (
              <EmptyState icon={Activity} title="No activity in this period" compact />
            ) : (
              <SimpleBarChart
                data={platformSeriesFiltered}
                series={[
                  { key: "Assignments", name: "Assignments", color: CHART_COLORS.accent },
                  { key: "Claims", name: "Claims", color: CHART_COLORS.success },
                ]}
              />
            )}
          </div>
        </Card>

        <Card flush>
          <CardHeader title="Pending tasks" subtitle="Items that need your attention" />
          <div className="iw-card__body stack iw-gap-3">
            {pendingTasks.map((task) => {
              const Icon = task.icon;
              return (
                <Link
                  key={task.label}
                  to={task.to}
                  className="iw-between"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <span className="iw-inline iw-gap-3">
                    <span className={`iw-stat__icon iw-stat__icon--${task.tone}`} style={{ width: 34, height: 34 }}>
                      <Icon size={17} strokeWidth={2.1} />
                    </span>
                    <span>
                      <span className="font-medium" style={{ display: "block" }}>{task.label}</span>
                      <span className="text-xs text-secondary">View and process</span>
                    </span>
                  </span>
                  <span className="iw-inline iw-gap-2">
                    <strong style={{ fontSize: 18 }}>{task.value}</strong>
                    <ArrowUpRight size={16} className="text-muted" />
                  </span>
                </Link>
              );
            })}

            <div className="iw-divider" />

            <div>
              <div className="iw-between">
                <span className="text-sm font-medium">Available assignment capacity</span>
                <span className="text-sm text-secondary">
                  {stats.availableAssignments} / {stats.totalAssignments || 1}
                </span>
              </div>
              <Progress
                className="iw-mt-2"
                value={stats.totalAssignments ? (stats.availableAssignments / stats.totalAssignments) * 100 : 0}
                tone="success"
              />
            </div>
          </div>
        </Card>
      </div>

      <div className="iw-grid iw-grid--halves iw-mt-5">
        <Card flush>
          <CardHeader
            title="Recent registrations"
            subtitle="Newest writers on the platform"
            actions={<Link to="/admin/writers"><Button size="sm" variant="ghost">View all</Button></Link>}
          />
          {recentWriters.length === 0 ? (
            <EmptyState icon={Users} title="No writers yet" compact />
          ) : (
            <ul>
              {recentWriters.map((writer) => (
                <li key={writer.id} className="iw-notif" style={{ cursor: "default" }}>
                  <Avatar name={writer.full_name ?? writer.email} src={writer.avatar_url} />
                  <div className="iw-notif__body">
                    <div className="iw-notif__title">{writer.full_name || "Unnamed writer"}</div>
                    <div className="iw-notif__text truncate">{writer.email}</div>
                    <div className="iw-notif__time">Joined {formatRelative(writer.created_at)}</div>
                  </div>
                  <StatusBadge kind="account" value={writer.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card flush>
          <CardHeader
            title="Recent claims"
            subtitle="Assignments picked up by writers"
            actions={<Link to="/admin/claims"><Button size="sm" variant="ghost">View all</Button></Link>}
          />
          {recentClaims.rows.length === 0 ? (
            <EmptyState icon={Briefcase} title="No claims yet" compact />
          ) : (
            <ul>
              {recentClaims.rows.map((claim) => (
                <li key={claim.id} className="iw-notif" style={{ cursor: "default" }}>
                  <Avatar name={claim.writer?.full_name ?? claim.writer?.email} src={claim.writer?.avatar_url} />
                  <div className="iw-notif__body">
                    <div className="iw-notif__title truncate">{claim.assignment?.title ?? "Assignment"}</div>
                    <div className="iw-notif__text">
                      {claim.writer?.full_name ?? "Writer"} · {claim.assignment?.assignment_code ?? "—"}
                    </div>
                    <div className="iw-notif__time">{formatRelative(claim.claimed_at)}</div>
                  </div>
                  <StatusBadge kind="claim" value={claim.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card flush>
          <CardHeader
            title="Submissions needing review"
            subtitle="Latest pending work"
            actions={<Link to="/admin/submissions"><Button size="sm" variant="ghost">Review</Button></Link>}
          />
          {recentSubmissions.rows.length === 0 ? (
            <EmptyState icon={FileCheck2} title="Nothing pending" description="All submissions have been reviewed." compact />
          ) : (
            <ul>
              {recentSubmissions.rows.map((submission) => (
                <li key={submission.id} className="iw-notif" style={{ cursor: "default" }}>
                  <span className="iw-notif__icon">
                    <FileCheck2 size={16} strokeWidth={2.1} />
                  </span>
                  <div className="iw-notif__body">
                    <div className="iw-notif__title truncate">
                      {submission.claim?.assignment?.title ?? "Submission"}
                    </div>
                    <div className="iw-notif__text">
                      {submission.claim?.writer?.full_name ?? "Writer"} · {formatRelative(submission.submitted_at)}
                    </div>
                  </div>
                  <StatusBadge kind="submission" value={submission.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card flush>
          <CardHeader title="Withdrawals awaiting action" subtitle="Oldest requests first" actions={<Link to="/admin/withdrawals"><Button size="sm" variant="ghost">Process</Button></Link>} />
          {pendingWithdrawals.length === 0 ? (
            <EmptyState icon={Wallet} title="No pending withdrawals" compact />
          ) : (
            <ul>
              {pendingWithdrawals.map((request) => (
                <li key={request.id} className="iw-notif" style={{ cursor: "default" }}>
                  <Avatar name={request.writer?.full_name ?? request.writer?.email} src={request.writer?.avatar_url} />
                  <div className="iw-notif__body">
                    <div className="iw-notif__title">{request.writer?.full_name ?? "Writer"}</div>
                    <div className="iw-notif__text">
                      {request.method ?? "—"} · requested {formatRelative(request.requested_at)}
                    </div>
                  </div>
                  <Money value={request.amount} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="iw-mt-5" flush>
        <CardHeader title="Recent platform activity" subtitle="Audit trail of key actions" actions={<Link to="/admin/activity"><Button size="sm" variant="ghost">Full log</Button></Link>} />
        <div className="iw-card__body">
          {activity.length === 0 ? (
            <EmptyState icon={Activity} title="No activity recorded yet" compact />
          ) : (
            <Timeline
              items={activity.map((entry) => ({
                icon: Activity,
                title: entry.activity ?? "Activity",
                meta: entry.actor?.full_name ?? entry.actor?.email ?? "System",
                time: entry.created_at,
              }))}
            />
          )}
        </div>
      </Card>

      <p className="text-xs text-muted iw-mt-4">
        Data reflects live Supabase records. Last refreshed {formatDate(new Date())}.
      </p>
    </div>
  );
}
