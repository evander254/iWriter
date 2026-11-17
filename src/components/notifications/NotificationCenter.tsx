import { useState } from "react";
import {
  Bell,
  BellRing,
  CheckCheck,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  Info,
  RefreshCcw,
  Trash2,
  UserCog,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button, Card, Chip, EmptyState, ErrorState, IconButton, Loading, PageHeader, Pagination } from "../common";
import { useAsync } from "../../hooks/useAsync";
import { useToast } from "../../contexts/ToastContext";
import {
  countUnreadNotifications,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../services";
import type { AppNotification } from "../../types/models";
import { formatRelative } from "../../utils/date";

const TYPE_ICON: Record<string, LucideIcon> = {
  claim: FileCheck2,
  submission: FileCheck2,
  approved: CheckCircle2,
  rejected: RefreshCcw,
  revision: RefreshCcw,
  withdrawal: Wallet,
  wallet: CreditCard,
  account: UserCog,
  info: Info,
};

export function NotificationCenter({ userId, title, description }: { userId: string; title: string; description: string }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload, setData } = useAsync(
    async () => {
      const [result, unread] = await Promise.all([
        listNotifications(userId, { page, pageSize: 15, unreadOnly: filter === "unread" }),
        countUnreadNotifications(userId),
      ]);
      return { result, unread };
    },
    [userId, page, filter],
  );

  const markOne = async (notification: AppNotification) => {
    if (notification.is_read) return;
    setData(
      data
        ? {
            ...data,
            unread: Math.max(0, data.unread - 1),
            result: {
              ...data.result,
              rows: data.result.rows.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)),
            },
          }
        : data,
    );
    await markNotificationRead(notification.id, true);
  };

  const markAll = async () => {
    setBusy(true);
    try {
      await markAllNotificationsRead();
      toast.success("All notifications marked as read");
      reload();
    } catch (err) {
      toast.error("Could not update notifications", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (notification: AppNotification) => {
    try {
      await deleteNotification(notification.id);
      toast.success("Notification removed");
      reload();
    } catch (err) {
      toast.error("Could not remove notification", err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <div className="animate-fade">
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            <Badge tone={data?.unread ? "accent" : "neutral"} dot={Boolean(data?.unread)}>
              {data?.unread ?? 0} unread
            </Badge>
            <Button variant="outline" icon={CheckCheck} onClick={markAll} loading={busy} disabled={!data?.unread}>
              Mark all read
            </Button>
          </>
        }
      />

      <Card flush>
        <div className="iw-toolbar">
          <div className="iw-filters">
            <Chip active={filter === "all"} onClick={() => { setFilter("all"); setPage(1); }}>
              All
            </Chip>
            <Chip active={filter === "unread"} count={data?.unread ?? 0} onClick={() => { setFilter("unread"); setPage(1); }}>
              Unread
            </Chip>
          </div>
          <div className="spacer" />
          <Button variant="ghost" icon={RefreshCcw} size="sm" onClick={reload}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <Loading label="Loading notifications…" />
        ) : error ? (
          <ErrorState description={error} onRetry={reload} />
        ) : !data || data.result.rows.length === 0 ? (
          <EmptyState
            icon={filter === "unread" ? BellRing : Bell}
            title={filter === "unread" ? "You're all caught up" : "No notifications yet"}
            description={
              filter === "unread"
                ? "There are no unread notifications right now."
                : "Updates about your assignments, submissions and wallet will appear here."
            }
          />
        ) : (
          <>
            <ul>
              {data.result.rows.map((notification) => {
                const Icon = TYPE_ICON[notification.type ?? "info"] ?? Bell;
                return (
                  <li
                    key={notification.id}
                    className={`iw-notif${notification.is_read ? "" : " iw-notif--unread"}`}
                    onClick={() => void markOne(notification)}
                  >
                    <span className="iw-notif__icon">
                      <Icon size={16} strokeWidth={2.1} />
                    </span>
                    <div className="iw-notif__body">
                      <div className="iw-notif__title">{notification.title ?? "Notification"}</div>
                      <div className="iw-notif__text">{notification.message ?? ""}</div>
                      <div className="iw-notif__time">{formatRelative(notification.created_at)}</div>
                    </div>
                    {!notification.is_read && <span className="iw-notif__dot" aria-label="Unread" />}
                    <IconButton
                      icon={Trash2}
                      label="Remove notification"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        void remove(notification);
                      }}
                    />
                  </li>
                );
              })}
            </ul>
            <Pagination page={page} pageSize={data.result.pageSize} total={data.result.count} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
