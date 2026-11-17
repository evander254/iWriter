import type { ReactNode } from "react";
import { cx } from "../../lib/utils";

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: Array<TabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cx("iw-tabs", className)} role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          className={cx("iw-tab", value === item.value && "is-active")}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          {item.count !== undefined && <span className="iw-tab__count">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}
