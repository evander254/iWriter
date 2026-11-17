import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../lib/utils";

export type BadgeTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "outline";

export interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  lg?: boolean;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "neutral", dot, lg, icon: Icon, children, className }: BadgeProps) {
  return (
    <span className={cx("iw-badge", tone !== "neutral" && `iw-badge--${tone}`, dot && "iw-badge--dot", lg && "iw-badge--lg", className)}>
      {Icon && <Icon size={12} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

export interface ChipProps {
  active?: boolean;
  count?: number;
  icon?: LucideIcon;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

export function Chip({ active, count, icon: Icon, onClick, children, className }: ChipProps) {
  return (
    <button type="button" onClick={onClick} className={cx("iw-chip", active && "is-active", className)} aria-pressed={active}>
      {Icon && <Icon size={14} strokeWidth={2.2} />}
      {children}
      {count !== undefined && <span className="iw-chip__count">{count}</span>}
    </button>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cx("iw-segmented", className)} role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={cx("iw-segmented__item", value === opt.value && "is-active")}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
