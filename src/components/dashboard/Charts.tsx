import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";
import { formatCurrencyCompact, formatCompact, formatCurrency } from "../../utils/format";

export const CHART_COLORS = {
  accent: "#635bdb",
  accent2: "#8b83f6",
  success: "#16a36a",
  warning: "#e8a23a",
  danger: "#e05252",
  info: "#3b82f6",
  neutral: "#98a2b3",
};

export const PIE_PALETTE = [
  CHART_COLORS.accent,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.info,
  CHART_COLORS.danger,
  CHART_COLORS.accent2,
  CHART_COLORS.neutral,
];

const AXIS_PROPS = {
  stroke: "var(--color-border-strong)",
  tick: { fill: "var(--color-text-muted)", fontSize: 11.5 },
  tickLine: false,
  axisLine: false,
} as const;

interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = (v: number | string) => String(v),
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  valueFormatter?: (value: number | string, key?: string | number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="iw-chart-tooltip">
      {label !== undefined && <div className="iw-chart-tooltip__label">{label}</div>}
      {payload.map((entry, i) => (
        <div className="iw-chart-tooltip__row" key={i}>
          <span className="iw-chart-tooltip__dot" style={{ background: entry.color ?? CHART_COLORS.accent }} />
          <span>{entry.name}</span>
          <span className="iw-chart-tooltip__value">{valueFormatter(entry.value ?? 0, entry.dataKey)}</span>
        </div>
      ))}
    </div>
  );
}

export interface SeriesConfig {
  key: string;
  name: string;
  color: string;
}

/* ---------------- Area chart ---------------- */

export function EarningsAreaChart({
  data,
  xKey = "label",
  series,
  height = 280,
  currency = true,
}: {
  data: Array<Record<string, string | number>>;
  xKey?: string;
  series: SeriesConfig[];
  height?: number;
  currency?: boolean;
}) {
  const formatter = currency
    ? (v: number | string) => formatCurrency(Number(v))
    : (v: number | string) => formatCompact(Number(v));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--color-border)" />
        <XAxis dataKey={xKey} {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={56} tickFormatter={(v) => (currency ? formatCurrencyCompact(Number(v)) : formatCompact(Number(v)))} />
        <Tooltip content={<ChartTooltip valueFormatter={formatter} />} cursor={{ stroke: "var(--color-border-strong)" }} />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2.4}
            fill={`url(#grad-${s.key})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ---------------- Bar chart ---------------- */

export function SimpleBarChart({
  data,
  xKey = "label",
  series,
  height = 280,
  currency = false,
  stacked = false,
}: {
  data: Array<Record<string, string | number>>;
  xKey?: string;
  series: SeriesConfig[];
  height?: number;
  currency?: boolean;
  stacked?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }} barGap={4}>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--color-border)" />
        <XAxis dataKey={xKey} {...AXIS_PROPS} />
        <YAxis
          {...AXIS_PROPS}
          width={52}
          tickFormatter={(v) => (currency ? formatCurrencyCompact(Number(v)) : formatCompact(Number(v)))}
        />
        <Tooltip
          content={<ChartTooltip valueFormatter={(v) => (currency ? formatCurrency(Number(v)) : formatCompact(Number(v)))} />}
          cursor={{ fill: "var(--color-bg-subtle)" }}
        />
        {series.length > 1 && <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12.5, paddingTop: 8 }} />}
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color}
            radius={[5, 5, 0, 0]}
            stackId={stacked ? "stack" : undefined}
            maxBarSize={38}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------------- Line chart ---------------- */

export function SimpleLineChart({
  data,
  xKey = "label",
  series,
  height = 260,
}: {
  data: Array<Record<string, string | number>>;
  xKey?: string;
  series: SeriesConfig[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--color-border)" />
        <XAxis dataKey={xKey} {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={48} tickFormatter={(v) => formatCompact(Number(v))} />
        <Tooltip content={<ChartTooltip valueFormatter={(v) => formatCompact(Number(v))} />} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2.4}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ---------------- Donut chart ---------------- */

export function DonutChart({
  data,
  height = 240,
  centerLabel,
  centerValue,
}: {
  data: Array<{ name: string; value: number; color?: string }>;
  height?: number;
  centerLabel?: ReactNode;
  centerValue?: ReactNode;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div style={{ position: "relative", height }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={entry.color ?? PIE_PALETTE[i % PIE_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip valueFormatter={(v) => formatCompact(Number(v))} />} />
        </PieChart>
      </ResponsiveContainer>
      {total > 0 && (centerValue !== undefined || centerLabel) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>{centerValue ?? formatCompact(total)}</div>
            {centerLabel && <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{centerLabel}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function ChartLegend({ items }: { items: Array<{ name: string; value?: ReactNode; color: string }> }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      {items.map((item) => (
        <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: item.color, flex: "none" }} />
          <span style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>{item.name}</span>
          {item.value !== undefined && <strong style={{ fontSize: 13 }}>{item.value}</strong>}
        </div>
      ))}
    </div>
  );
}
