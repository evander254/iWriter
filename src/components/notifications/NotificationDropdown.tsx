import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BellRing, CheckCheck, Clock3, CreditCard, FileCheck2, Info, RefreshCcw, UserCog, Wallet, type LucideIcon } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { listNotifications, markNotificationRead } from "../../services/notifications";
import { formatRelative } from "../../utils/date";

const TYPE_ICON: Record<string, LucideIcon> = {
  claim: FileCheck2,
  submission: FileCheck2,
  approved: CheckCheck,
  rejected: RefreshCcw,
  revision: RefreshCcw,
  withdrawal: Wallet,
  wallet: CreditCard,
  account: UserCog,
  assignment: FileCheck2,
  assignment_deadline_30: Clock3,
  info: Info,
};

export function NotificationDropdown({ userId, notificationsPath, unreadCount = 0 }: {
  userId: string;
  notificationsPath: string;
  unreadCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { data, loading, error } = useAsync(
    () => listNotifications(userId, { page: 1, pageSize: 10, unreadOnly: true }),
    [userId],
  );

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const openNotification = async (id: string) => {
    setOpen(false);
    await markNotificationRead(id, true);
    window.dispatchEvent(new CustomEvent("iw:realtime"));
    navigate(`${notificationsPath}#notification-${encodeURIComponent(id)}`);
  };

  return (
    <div className="iw-notification-menu" ref={rootRef}>
      <button
        type="button"
        className="iw-iconbtn iw-notification-menu__trigger"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Notifications"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={18} />
        {unreadCount > 0 && <span className="iw-notification-menu__count">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>

      {open && <section className="iw-notification-menu__panel" aria-label="Unread notifications">
        <header className="iw-notification-menu__header">
          <div><strong>Notifications</strong><span>{unreadCount} unread</span></div>
          <button type="button" onClick={() => { setOpen(false); navigate(notificationsPath); }}>View more</button>
        </header>
        {loading ? <div className="iw-notification-menu__state">Loading notifications…</div> : error ? (
          <div className="iw-notification-menu__state iw-notification-menu__error">Could not load notifications.</div>
        ) : !data?.rows.length ? (
          <div className="iw-notification-menu__state"><BellRing size={19} /><strong>You’re all caught up</strong><span>New updates will appear here.</span></div>
        ) : (
          <ul className="iw-notification-menu__list">
            {data.rows.map((notification) => {
              const Icon = TYPE_ICON[notification.type ?? "info"] ?? Bell;
              return <li key={notification.id}>
                <button type="button" onClick={() => void openNotification(notification.id)}>
                  <span className="iw-notification-menu__icon"><Icon size={16} /></span>
                  <span className="iw-notification-menu__copy">
                    <strong>{notification.title || "Notification"}</strong>
                    <span>{notification.message || "You have a new update."}</span>
                    <time>{formatRelative(notification.created_at)}</time>
                  </span>
                  <i aria-label="Unread" />
                </button>
              </li>;
            })}
          </ul>
        )}
        <button type="button" className="iw-notification-menu__footer" onClick={() => { setOpen(false); navigate(notificationsPath); }}>
          View all notifications
        </button>
      </section>}
    </div>
  );
}
