import type { ReactNode } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp } from "lucide-react";
import { cx } from "../../lib/utils";

/* ------------------------------------------------------------------ */
/* Table primitives                                                    */
/* ------------------------------------------------------------------ */

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("iw-table-wrap", className)}>{children}</div>;
}

export interface TableProps {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}

export function Table({ children, className, compact }: TableProps) {
  return (
    <div className="iw-table-wrap">
      <table className={cx("iw-table", compact && "iw-table--compact", className)}>{children}</table>
    </div>
  );
}

export type SortDir = "asc" | "desc";

export interface SortHeaderProps {
  label: ReactNode;
  field: string;
  sortBy?: string;
  sortDir?: SortDir;
  onSort?: (field: string) => void;
  numeric?: boolean;
  className?: string;
}

export function SortHeader({ label, field, sortBy, sortDir, onSort, numeric, className }: SortHeaderProps) {
  const active = sortBy === field;
  return (
    <th className={cx(numeric && "iw-table__num", className)} aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
      {onSort ? (
        <button type="button" className={cx("iw-table__sort", active && "is-active")} onClick={() => onSort(field)}>
          {label}
          <span className="iw-table__sort-icon">
            {!active ? <ChevronsUpDown size={13} /> : sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </button>
      ) : (
        label
      )}
    </th>
  );
}

export function Th({ children, numeric, className }: { children?: ReactNode; numeric?: boolean; className?: string }) {
  return <th className={cx(numeric && "iw-table__num", className)}>{children}</th>;
}

export function Td({ children, numeric, className, colSpan }: { children?: ReactNode; numeric?: boolean; className?: string; colSpan?: number }) {
  return (
    <td className={cx(numeric && "iw-table__num", className)} colSpan={colSpan}>
      {children}
    </td>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, pageSize, total, onPageChange, className }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages = buildPageList(page, pageCount);

  return (
    <div className={cx("iw-pagination", className)}>
      <span className="iw-pagination__info">
        Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong>
      </span>
      <div className="iw-pagination__pages">
        <button type="button" className="iw-pagebtn" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft size={15} />
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="iw-pagination__info" style={{ padding: "0 4px" }}>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={cx("iw-pagebtn", p === page && "is-active")}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" className="iw-pagebtn" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Next page">
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

function buildPageList(current: number, count: number): Array<number | "…"> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const pages: Array<number | "…"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(count - 1, current + 1);
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < count - 1) pages.push("…");
  pages.push(count);
  return pages;
}
