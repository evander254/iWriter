import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Award,
  Bell,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Coins,
  FileCheck2,
  FileClock,
  Megaphone,
  Sparkles,
  TrendingUp,
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
} from "../../components/common";
import { StatusBadge } from "../../components/common/StatusBadge";
import { AssignmentCard, AssignmentCardSkeleton } from "../../components/assignments/AssignmentCard";
import { EarningsAreaChart, CHART_COLORS } from "../../components/dashboard/Charts";
import { useAsync } from "../../hooks/useAsync";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { displayName } from "../../types";
import {
  claimAssignment,
  getEarningPoints,
  listAnnouncements,
  listMarketplaceAssignments,
  listRecentNotifications,
  listRecentWithdrawals,
  listRevisionRequestsForWriter,
  listWriterClaims,
  listWriterSubmissions,
} from "../../services";
import { formatCurrency, formatNumber } from "../../utils/format";
import { formatRelative } from "../../utils/date";
import { buildTimeSeries, RANGE_OPTIONS, rangeStart, type RangePreset } from "../../utils/charts";

export function WriterOverviewPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [range, setRange] = useState<RangePreset>("30d");
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(async () => {
    if (!user) return null;
    const [claims, submissions, notifications, announcements, withdrawals, earnings, marketplace, revisionRequests] = await Promise.all([
      listWriterClaims(user.id, { pageSize: 100 }),
      listWriterSubmissions(user.id, { pageSize: 100 }),
      listRecentNotifications(user.id, 6),
      listAnnouncements(true),
      listRecentWithdrawals(user.id, 4),
      getEarningPoints(user.id),
      listMarketplaceAssignments({ pageSize: 6, sortBy: "created_at" }),
      listRevisionRequestsForWriter(user.id),
    ]);
    return { claims, submissions, notifications, announcements, withdrawals, earnings, marketplace, revisionRequests };
  }, [user?.id]);

  const stats = useMemo(() => {
    if (!data || !profile) return null;
    const claims = data.claims.rows;
    const active = claims.filter((c) => ["claimed", "submitted", "revision"].includes(c.status));
    const approved = claims.filter((c) => c.status === "approved");
    return {
      active: active.length,
      approved: approved.length,
      total: claims.length,
      pendingSubmissions: data.submissions.rows.filter((s) => s.status === "pending").length,
      revisions: data.revisionRequests.filter((r) => r.status === "pending").length,
      completion: claims.length > 0 ? (approved.length / claims.length) * 100 : 0,
    };
  }, [data, profile]);

  const series = useMemo(() => {
    if (!data) return [];
    const start = rangeStart(range);
    return buildTimeSeries(data.earnings.filter((p) => new Date(p.created_at) >= start), range);
  }, [data, range]);

  const rangeTotal = series.reduce((sum, p) => sum + p.value, 0);

  if (loading) return <Loading full label="Loading your workspace…" />;
  if (error || !data || !profile || !stats) {
    return <ErrorState title="Unable to load your dashboard" description={error ?? "Please try again."} onRetry={reload} />;
  }

  const handleClaim = async (assignmentId: string, title: string) => {
    setClaimingId(assignmentId);
    try {
      await claimAssignment(assignmentId);
      toast.success("Assignment claimed", `"${title}" is now yours to complete.`);
      reload();
    } catch (err) {
      toast.error("Could not claim assignment", err instanceof Error ? err.message : undefined);
    } finally {
      setClaimingId(null);
    }
  };

  const pendingTasks = [
    { label: "Awaiting review", value: stats.pendingSubmissions, to: "/writer/submissions", icon: FileCheck2, tone: "warning" as const },
    { label: "Revisions requested", value: stats.revisions, to: "/writer/revisions", icon: FileClock, tone: "info" as const },
    { label: "Active assignments", value: stats.active, to: "/writer/my-assignments", icon: Briefcase, tone: "accent" as const },
  ];

  return (
    <div className="animate-fade">
      <PageHeader
        title={`Welcome back, ${(profile.full_name ?? "writer").split(" ")[0]}`}
        description="Here's everything happening with your assignments and earnings."
        actions={
          <>
            <Segmented value={range} onChange={setRange} options={RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label.replace("Last ", "") }))} />
            <Button variant="primary" icon={Award} onClick={() => navigate("/writer/assignments")}>
              Browse assignments
            </Button>
          </>
        }
      />

      <div className="iw-grid iw-grid--stats">
        <StatCard label="Available balance" value={formatCurrency(profile.available_balance)} icon={Wallet} tone="accent" foot="ready to withdraw" onClick={() => navigate("/writer/wallet")} />
        <StatCard label="Lifetime earnings" value={formatCurrency(profile.total_earnings)} icon={Coins} tone="success" foot="all time" />
        <StatCard label="Active assignments" value={formatNumber(stats.active)} icon={Briefcase} tone="warning" foot="in progress" onClick={() => navigate("/writer/my-assignments")} />
        <StatCard label="Completed" value={formatNumber(stats.approved)} icon={CheckCircle2} tone="success" foot="approved" />
        <StatCard label="Awaiting review" value={formatNumber(stats.pendingSubmissions)} icon={FileCheck2} tone="info" foot="submissions" onClick={() => navigate("/writer/submissions")} />
        <StatCard label="Revisions" value={formatNumber(stats.revisions)} icon={FileClock} tone="danger" foot="need action" onClick={() => navigate("/writer/revisions")} />
      </div>

      <div className="iw-grid iw-grid--2-1 iw-mt-5">
        <Card flush>
          <CardHeader
            title="Your earnings"
            subtitle={`${formatCurrency(rangeTotal)} earned in the selected period`}
            actions={<Badge tone="success">{formatCurrency(profile.total_earnings)} lifetime</Badge>}
          />
          <div className="iw-chart-card__body">
            {series.every((p) => p.value === 0) ? (
              <EmptyState icon={TrendingUp} title="No earnings in this period" description="Complete assignments to start earning." compact />
            ) : (
              <EarningsAreaChart data={series} series={[{ key: "value", name: "Earnings", color: CHART_COLORS.success }]} />
            )}
          </div>
        </Card>

        <Card flush>
          <CardHeader title="Needs your attention" subtitle="Keep your work moving" />
          <div className="iw-card__body stack iw-gap-3">
            {pendingTasks.map((task) => {
              const Icon = task.icon;
              return (
                <Link key={task.label} to={task.to} className="iw-between" style={{ textDecoration: "none", color: "inherit" }}>
                  <span className="iw-inline iw-gap-3">
                    <span className={`iw-stat__icon iw-stat__icon--${task.tone}`} style={{ width: 34, height: 34 }}>
                      <Icon size={17} strokeWidth={2.1} />
                    </span>
                    <span className="font-medium">{task.label}</span>
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
              <div className="iw-between iw-mb-2">
                <span className="text-sm font-medium">Completion rate</span>
                <span className="text-sm text-secondary">{Math.round(stats.completion)}%</span>
              </div>
              <Progress value={stats.completion} tone="success" />
              <p className="text-xs text-muted iw-mt-2">
                {stats.approved} of {stats.total} claimed assignments approved
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="iw-mt-5" flush>
        <CardHeader
          title="Recommended for you"
          subtitle="Fresh assignments open for claims"
          actions={
            <Link to="/writer/assignments">
              <Button size="sm" variant="ghost">
                View all
              </Button>
            </Link>
          }
        />
        <div className="iw-card__body">
          {data.marketplace.rows.length === 0 ? (
            <EmptyState icon={Sparkles} title="No assignments available" description="Check back soon — new work is published regularly." compact />
          ) : (
            <div className="iw-grid iw-grid--cards">
              {data.marketplace.rows.map((assignment) => (
                <AssignmentCard
                  key={assignment.id}
                  assignment={assignment}
                  onView={() => navigate(`/writer/assignments/${assignment.id}`)}
                  onClaim={() => void handleClaim(assignment.id, assignment.title)}
                  claiming={claimingId === assignment.id}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="iw-grid iw-grid--halves iw-mt-5">
        <Card flush>
          <CardHeader
            title="Recent claims"
            subtitle="Your latest assignments"
            actions={
              <Link to="/writer/my-assignments">
                <Button size="sm" variant="ghost">
                  View all
                </Button>
              </Link>
            }
          />
          {data.claims.rows.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No claims yet" description="Claim an assignment to get started." compact />
          ) : (
            <ul>
              {data.claims.rows.slice(0, 5).map((claim) => (
                <li key={claim.id} className="iw-notif" style={{ cursor: "default" }}>
                  <span className="iw-notif__icon">
                    <Briefcase size={16} strokeWidth={2.1} />
                  </span>
                  <div className="iw-notif__body">
                    <div className="iw-notif__title truncate">{claim.assignment?.title ?? "Assignment"}</div>
                    <div className="iw-notif__text">
                      {claim.assignment?.assignment_code ?? "—"} · {formatRelative(claim.claimed_at)}
                    </div>
                  </div>
                  <StatusBadge kind="claim" value={claim.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card flush>
          <CardHeader
            title="Notifications"
            subtitle="Latest updates"
            actions={
              <Link to="/writer/notifications">
                <Button size="sm" variant="ghost">
                  View all
                </Button>
              </Link>
            }
          />
          {data.notifications.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications" description="You're all caught up." compact />
          ) : (
            <ul>
              {data.notifications.map((notification) => (
                <li key={notification.id} className={`iw-notif${notification.is_read ? "" : " iw-notif--unread"}`} style={{ cursor: "default" }}>
                  <span className="iw-notif__icon">
                    <Bell size={16} strokeWidth={2.1} />
                  </span>
                  <div className="iw-notif__body">
                    <div className="iw-notif__title truncate">{notification.title ?? "Notification"}</div>
                    <div className="iw-notif__text truncate">{notification.message ?? ""}</div>
                    <div className="iw-notif__time">{formatRelative(notification.created_at)}</div>
                  </div>
                  {!notification.is_read && <span className="iw-notif__dot" />}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card flush>
          <CardHeader
            title="Announcements"
            subtitle="From the iWriter team"
            actions={
              <Link to="/writer/announcements">
                <Button size="sm" variant="ghost">
                  View all
                </Button>
              </Link>
            }
          />
          {data.announcements.length === 0 ? (
            <EmptyState icon={Megaphone} title="No announcements" compact />
          ) : (
            <div className="iw-card__body stack iw-gap-3">
              {data.announcements.slice(0, 3).map((item) => (
                <div key={item.id} className="iw-quote">
                  <Megaphone size={15} />
                  <div>
                    <div className="font-medium">{item.title ?? "Announcement"}</div>
                    <p className="text-sm text-secondary clamp-2">{item.message ?? ""}</p>
                    <div className="text-xs text-muted iw-mt-2">{formatRelative(item.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card flush>
          <CardHeader
            title="Recent withdrawals"
            subtitle="Payout activity"
            actions={
              <Link to="/writer/wallet">
                <Button size="sm" variant="ghost">
                  Wallet
                </Button>
              </Link>
            }
          />
          {data.withdrawals.length === 0 ? (
            <EmptyState icon={Wallet} title="No withdrawals yet" description="Withdraw your balance anytime." compact />
          ) : (
            <ul>
              {data.withdrawals.map((request) => (
                <li key={request.id} className="iw-notif" style={{ cursor: "default" }}>
                  <Avatar name={displayName(profile)} src={profile.avatar_url} size="sm" />
                  <div className="iw-notif__body">
                    <div className="iw-notif__title">{request.method ?? "Withdrawal"}</div>
                    <div className="iw-notif__text">Requested {formatRelative(request.requested_at)}</div>
                  </div>
                  <div className="stack" style={{ alignItems: "flex-end", gap: 4 }}>
                    <Money value={request.amount} />
                    <StatusBadge kind="withdrawal" value={request.status} dot={false} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {data.marketplace.rows.length === 0 && (
        <div className="iw-grid iw-grid--cards iw-mt-5">
          <AssignmentCardSkeleton />
        </div>
      )}
    </div>
  );
}
