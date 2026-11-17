import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cx } from "../../lib/utils";
import { useClickOutside, useEscapeKey, useLockBodyScroll } from "../../hooks/useUi";
import { Button, IconButton, type ButtonVariant } from "./Button";

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: ReactNode;
  children: ReactNode;
  /** Hide the close button (e.g. for blocking dialogs). */
  hideClose?: boolean;
}

export function Modal({ open, onClose, title, description, size = "md", footer, children, hideClose }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useEscapeKey(onClose, open);
  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        "input, select, textarea, button, [tabindex]:not([tabindex='-1'])",
      );
      focusable?.focus();
    }, 40);
    return () => {
      clearTimeout(timer);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="iw-modal" role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined}>
      <div className="iw-modal__backdrop" onClick={onClose} />
      <div ref={panelRef} className={cx("iw-modal__panel", size !== "md" && `iw-modal__panel--${size}`)}>
        {(title || !hideClose) && (
          <div className="iw-modal__header">
            <div style={{ minWidth: 0 }}>
              {title && (
                <h2 className="iw-modal__title" id={titleId}>
                  {title}
                </h2>
              )}
              {description && <p className="iw-modal__desc">{description}</p>}
            </div>
            {!hideClose && (
              <IconButton icon={X} label="Close" onClick={onClose} className="iw-modal__close" />
            )}
          </div>
        )}
        <div className="iw-modal__body">{children}</div>
        {footer && <div className="iw-modal__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Confirm dialog                                                      */
/* ------------------------------------------------------------------ */

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ButtonVariant;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  loading,
  onConfirm,
  onClose,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Dropdown                                                            */
/* ------------------------------------------------------------------ */

export interface DropdownItem {
  label: ReactNode;
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface DropdownProps {
  trigger: ReactNode;
  items?: Array<DropdownItem | "divider" | { label: ReactNode }>;
  align?: "left" | "right";
  className?: string;
}

export function Dropdown({ trigger, items = [], align = "right", className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);
  useEscapeKey(() => setOpen(false), open);

  return (
    <div className={cx("iw-dropdown", className)} ref={ref}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div className={cx("iw-dropdown__menu", align === "left" && "iw-dropdown__menu--left")} role="menu">
          {items.map((item, index) => {
            if (item === "divider") return <div key={index} className="iw-dropdown__divider" />;
            if ("label" in item && !("onClick" in item) && !("icon" in item)) {
              return (
                <div key={index} className="iw-dropdown__label">
                  {item.label}
                </div>
              );
            }
            const it = item as DropdownItem;
            const Icon = it.icon;
            return (
              <button
                key={index}
                type="button"
                role="menuitem"
                disabled={it.disabled}
                className={cx("iw-dropdown__item", it.danger && "iw-dropdown__item--danger")}
                onClick={() => {
                  setOpen(false);
                  it.onClick?.();
                }}
              >
                {Icon && <Icon size={16} strokeWidth={2.1} />}
                {it.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
