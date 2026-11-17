import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { AlertCircle, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cx } from "../../lib/utils";

/* ------------------------------------------------------------------ */
/* Field wrapper                                                       */
/* ------------------------------------------------------------------ */

export interface FieldProps {
  label?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  /** Render label row inline with an action (e.g. "Forgot password?") */
  action?: ReactNode;
}

export function Field({ label, htmlFor, required, hint, error, children, className, action }: FieldProps) {
  return (
    <div className={cx("iw-field", className)}>
      {label && (
        <div className="iw-between" style={{ gap: 8 }}>
          <label className="iw-field__label" htmlFor={htmlFor}>
            {label}
            {required && <span className="iw-field__required">*</span>}
          </label>
          {action}
        </div>
      )}
      {children}
      {error ? (
        <span className="iw-field__error" role="alert">
          <AlertCircle size={13} strokeWidth={2.4} />
          {error}
        </span>
      ) : (
        hint && <span className="iw-field__hint">{hint}</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  icon?: LucideIcon;
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, icon: Icon, suffix, className, ...rest },
  ref,
) {
  const input = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx("iw-input", className)}
      {...rest}
    />
  );

  if (!Icon && !suffix) return input;

  return (
    <div className="iw-input-group">
      {Icon && (
        <span className="iw-input-group__icon">
          <Icon size={16} strokeWidth={2.1} />
        </span>
      )}
      {input}
      {suffix && <span className="iw-input-group__suffix">{suffix}</span>}
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx("iw-textarea", className)}
      {...rest}
    />
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx("iw-select", className)}
      {...rest}
    >
      {children}
    </select>
  );
});

export interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { className, ...rest },
  ref,
) {
  return (
    <div className={cx("iw-search", className)}>
      <span className="iw-search__icon">
        <Search size={16} strokeWidth={2.2} />
      </span>
      <input ref={ref} type="search" className="iw-input" {...rest} />
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Checkbox / Switch                                                   */
/* ------------------------------------------------------------------ */

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  description?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, ...rest },
  ref,
) {
  return (
    <label className={cx("iw-check", className)}>
      <input ref={ref} type="checkbox" {...rest} />
      {(label || description) && (
        <span className="iw-check__text">
          {label}
          {description && <span className="iw-check__desc">{description}</span>}
        </span>
      )}
    </label>
  );
});

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: ReactNode;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, className, ...rest },
  ref,
) {
  return (
    <label className={cx("iw-switch", className)}>
      <input ref={ref} type="checkbox" {...rest} />
      {label && <span>{label}</span>}
    </label>
  );
});

/* ------------------------------------------------------------------ */
/* Layout helpers                                                      */
/* ------------------------------------------------------------------ */

export function FieldRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("iw-field-row", className)}>{children}</div>;
}
