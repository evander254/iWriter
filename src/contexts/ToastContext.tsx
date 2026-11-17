import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cx, uid } from "../lib/utils";

export type ToastTone = "info" | "success" | "error" | "warning";

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (toast: Omit<Toast, "id">) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = {
  info: Info,
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: Omit<Toast, "id">) => {
      const id = uid("toast");
      const item: Toast = { id, duration: 4500, ...input };
      setToasts((current) => [...current, item]);
      if (item.duration && item.duration > 0) {
        setTimeout(() => dismiss(id), item.duration);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast({ tone: "success", title, description }),
      error: (title, description) => toast({ tone: "error", title, description, duration: 6000 }),
      info: (title, description) => toast({ tone: "info", title, description }),
      warning: (title, description) => toast({ tone: "warning", title, description }),
    }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="iw-toaster" role="region" aria-label="Notifications">
          {toasts.map((t) => {
            const Icon = ICONS[t.tone];
            return (
              <div key={t.id} className={cx("iw-toast", t.tone !== "info" && `iw-toast--${t.tone}`)} role="status">
                <span className="iw-toast__icon">
                  <Icon size={16} strokeWidth={2.3} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="iw-toast__title">{t.title}</div>
                  {t.description && <div className="iw-toast__desc">{t.description}</div>}
                </div>
                <button type="button" className="iw-toast__close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                  <X size={15} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
