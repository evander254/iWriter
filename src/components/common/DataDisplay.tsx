import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cx } from "../../lib/utils";
import { formatCurrency } from "../../utils/format";
import { formatRelative } from "../../utils/date";

/* ---------------- Avatar ---------------- */
export interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const initials = getInitials(name);
  return (
    <span className={cx("iw-avatar", size !== "md" && `iw-avatar--${size}`, className)} aria-hidden>
      {src ? <img src={src} alt="" loading="lazy" /> : initials}
    </span>
  );
}

export function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ---------------- Stat card ---------------- */
export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: "accent" | "success" | "warning" | "danger" | "info";
  trend?: number | null;
  foot?: ReactNode;
  compact?: boolean;
  onClick?: () => void;
}

export function StatCard({ label, value, icon: Icon, tone = "accent", trend, foot, compact, onClick }: StatCardProps) {
  return (
    <div className={cx("iw-stat", compact && "iw-stat--compact")} onClick={onClick} role={onClick ? "button" : undefined} style={onClick ? { cursor: "pointer" } : undefined}>
      <div className="iw-stat__top">
        {Icon && (
          <span className={cx("iw-stat__icon", tone !== "accent" && `iw-stat__icon--${tone}`)}>
            <Icon size={18} strokeWidth={2.1} />
          </span>
        )}
        <span className="iw-stat__label">{label}</span>
      </div>
      <div className="iw-stat__value">{value}</div>
      {(foot || trend !== undefined) && (
        <div className="iw-stat__foot">
          {trend !== undefined && trend !== null && (
            <span className={cx("iw-stat__trend", trend >= 0 ? "iw-stat__trend--up" : "iw-stat__trend--down")}>
              {trend >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          {foot}
        </div>
      )}
    </div>
  );
}

/* ---------------- Money ---------------- */
export function Money({ value, tone, className }: { value: number | string | null | undefined; tone?: "pos" | "neg"; className?: string }) {
  const n = typeof value === "string" ? Number.parseFloat(value) : (value ?? 0);
  const resolvedTone = tone ?? (n > 0 ? undefined : n < 0 ? "neg" : undefined);
  return <span className={cx("iw-money", resolvedTone && `iw-money--${resolvedTone}`, className)}>{formatCurrency(n)}</span>;
}

/* ---------------- Page header ---------------- */
export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({ title, description, actions, children }: PageHeaderProps) {
  return (
    <div className="iw-page-head">
      <div className="iw-page-head__text">
        <h1 className="iw-page-head__title">{title}</h1>
        {description && <p className="iw-page-head__desc">{description}</p>}
        {children}
      </div>
      {actions && <div className="iw-page-head__actions">{actions}</div>}
    </div>
  );
}

/* ---------------- Description list ---------------- */
export interface DescriptionItem {
  label: ReactNode;
  value: ReactNode;
}

export function DescriptionList({ items, inline }: { items: DescriptionItem[]; inline?: boolean }) {
  return (
    <dl className={cx("iw-dl", inline && "iw-dl--inline")}>
      {items.map((item, i) => (
        <div className="iw-dl__item" key={i}>
          <dt className="iw-dl__label">{item.label}</dt>
          <dd className="iw-dl__value">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------------- Meta item ---------------- */
export function Meta({ icon: Icon, label, value }: { icon?: LucideIcon; label?: ReactNode; value: ReactNode }) {
  return (
    <div className="iw-meta">
      {Icon && <Icon className="iw-meta__icon" size={15} strokeWidth={2.1} />}
      <div style={{ minWidth: 0 }}>
        {label && <div className="iw-meta__label">{label}</div>}
        <div className="iw-meta__value">{value}</div>
      </div>
    </div>
  );
}

/* ---------------- Timeline ---------------- */
export interface TimelineItem {
  icon?: LucideIcon;
  title: ReactNode;
  meta?: ReactNode;
  time?: string | null;
}

export function Timeline({ items, empty }: { items: TimelineItem[]; empty?: ReactNode }) {
  if (items.length === 0) return <>{empty}</>;
  return (
    <div className="iw-timeline">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <div className="iw-timeline__item" key={i}>
            <div className="iw-timeline__rail">
              <span className="iw-timeline__dot">{Icon ? <Icon size={15} strokeWidth={2.2} /> : <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor" }} />}</span>
              <span className="iw-timeline__line" />
            </div>
            <div className="iw-timeline__body">
              <div className="iw-timeline__title">{item.title}</div>
              {(item.meta || item.time) && (
                <div className="iw-timeline__meta">
                  {item.meta}
                  {item.meta && item.time ? " · " : ""}
                  {item.time ? formatRelative(item.time) : ""}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Detail head ---------------- */
export function DetailHead({
  title,
  meta,
  actions,
  avatar,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  avatar?: ReactNode;
}) {
  return (
    <div className="iw-detail-head">
      {avatar}
      <div className="iw-detail-head__main">
        <h1 className="iw-detail-head__title">{title}</h1>
        {meta && <div className="iw-detail-head__meta">{meta}</div>}
      </div>
      {actions && <div className="iw-detail-head__actions">{actions}</div>}
    </div>
  );
}
