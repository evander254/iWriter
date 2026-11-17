import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  pad?: boolean;
  padLg?: boolean;
  flush?: boolean;
}

export function Card({ hover, pad, padLg, flush, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        "iw-card",
        hover && "iw-card--hover",
        pad && "iw-card--pad",
        padLg && "iw-card--pad-lg",
        flush && "iw-card--flush",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, icon: Icon, actions, children, className }: CardHeaderProps) {
  return (
    <div className={cx("iw-card__header", className)}>
      {Icon && (
        <span className="iw-stat__icon" style={{ width: 34, height: 34 }}>
          <Icon size={17} strokeWidth={2.1} />
        </span>
      )}
      <div style={{ minWidth: 0 }}>
        {title && <div className="iw-card__title">{title}</div>}
        {subtitle && <div className="iw-card__subtitle">{subtitle}</div>}
        {children}
      </div>
      {actions && <div className="iw-card__actions">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("iw-card__body", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("iw-card__footer", className)} {...rest}>
      {children}
    </div>
  );
}

export interface SectionProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** A card with a titled header and padded body — the standard content block. */
export function Section({ title, subtitle, icon, actions, children, className, bodyClassName }: SectionProps) {
  return (
    <Card flush className={className}>
      {(title || actions) && (
        <CardHeader title={title} subtitle={subtitle} icon={icon} actions={actions} />
      )}
      <div className={cx("iw-card__body", bodyClassName)}>{children}</div>
    </Card>
  );
}
