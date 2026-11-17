import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cx } from "../../lib/utils";
import { Button } from "./Button";

/* ---------------- Alert ---------------- */
export type AlertTone = "info" | "success" | "warning" | "danger" | "neutral";

const ALERT_ICON: Record<AlertTone, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  neutral: Info,
};

export interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: LucideIcon | null;
  className?: string;
  action?: ReactNode;
}

export function Alert({ tone = "info", title, children, icon, className, action }: AlertProps) {
  const Icon = icon === null ? null : (icon ?? ALERT_ICON[tone]);
  return (
    <div className={cx("iw-alert", tone !== "info" && `iw-alert--${tone}`, className)} role={tone === "danger" ? "alert" : undefined}>
      {Icon && (
        <span className="iw-alert__icon">
          <Icon size={17} strokeWidth={2.2} />
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div className="iw-alert__title">{title}</div>}
        {children && <div>{children}</div>}
      </div>
      {action}
    </div>
  );
}

/* ---------------- Spinner / loading ---------------- */
export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return <span className={cx("iw-spinner", size !== "md" && `iw-spinner--${size}`)} role="status" aria-label="Loading" />;
}

export function Loading({ label = "Loading…", full }: { label?: string; full?: boolean }) {
  return (
    <div className={cx("iw-loading", full && "iw-loading--full")}>
      <Spinner size="lg" />
      <span>{label}</span>
    </div>
  );
}

/* ---------------- Skeleton ---------------- */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cx("iw-skeleton", className)} style={style} aria-hidden />;
}

export function SkeletonCard() {
  return (
    <div className="iw-card iw-card--pad">
      <Skeleton style={{ width: 40, height: 40, borderRadius: 12 }} />
      <div style={{ marginTop: 16 }}>
        <Skeleton className="iw-skeleton--text" style={{ width: "45%" }} />
        <Skeleton className="iw-skeleton--text" style={{ width: "70%", height: 22, marginTop: 10 }} />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="iw-card iw-card--pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="iw-skeleton--text" style={{ width: `${100 - (i % 3) * 12}%`, height: 14 }} />
      ))}
    </div>
  );
}

/* ---------------- Empty state ---------------- */
export interface EmptyStateProps {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div className={cx("iw-empty", compact && "iw-empty--sm", className)}>
      {Icon && (
        <div className="iw-empty__icon">
          <Icon size={compact ? 22 : 28} strokeWidth={1.9} />
        </div>
      )}
      <div className="iw-empty__title">{title}</div>
      {description && <p className="iw-empty__desc">{description}</p>}
      {action && <div className="iw-mt-3">{action}</div>}
    </div>
  );
}

/* ---------------- Error state ---------------- */
export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={XCircle}
      title={title}
      description={description}
      action={onRetry ? <Button variant="outline" onClick={onRetry}>Try again</Button> : undefined}
    />
  );
}

/* ---------------- Progress ---------------- */
export function Progress({
  value,
  tone = "accent",
  size,
  className,
}: {
  value: number;
  tone?: "accent" | "success" | "warning" | "danger";
  size?: "lg";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cx("iw-progress", size === "lg" && "iw-progress--lg", className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx("iw-progress__bar", tone !== "accent" && `iw-progress__bar--${tone}`)} style={{ width: `${pct}%` }} />
    </div>
  );
}
