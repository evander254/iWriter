import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "outline"
  | "danger"
  | "danger-soft"
  | "success"
  | "success-soft"
  | "warning-soft";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  pill?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "outline",
    size = "md",
    block,
    pill,
    loading,
    icon: Icon,
    iconRight: IconRight,
    className,
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        "iw-btn",
        variant !== "outline" && `iw-btn--${variant}`,
        size !== "md" && `iw-btn--${size}`,
        block && "iw-btn--block",
        pill && "iw-btn--pill",
        !children && "iw-btn--icon",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span className="iw-btn__spinner" aria-hidden />
      ) : (
        Icon && <Icon size={size === "sm" ? 14 : 16} strokeWidth={2.1} />
      )}
      {children}
      {IconRight && !loading && <IconRight size={size === "sm" ? 14 : 16} strokeWidth={2.1} />}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, variant = "ghost", size = "md", className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cx("iw-btn", variant !== "outline" && `iw-btn--${variant}`, `iw-btn--icon`, size === "sm" && "iw-btn--sm", className)}
      {...rest}
    >
      <Icon size={size === "sm" ? 15 : 17} strokeWidth={2.1} />
    </button>
  );
});
