import {
  CartesianGrid,
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useId } from "react";
import { dateLabel, dates, fmt, priceAt } from "./data";
import type { Fuel } from "./data";

export type PlotRow = { date: string; [key: string]: number | string | null };
export const lineColors = ["#87df50", "var(--ink)", "#a49bc5", "#d9bc87"];
export function priceRows(
  regions: string[],
  fuel: Fuel,
  start: string,
  end: string,
): PlotRow[] {
  return dates
    .filter((d) => d >= start && d <= end)
    .map((date) => ({
      date,
      ...Object.fromEntries(
        regions.map((r) => [r, priceAt(r, fuel, date) ?? null]),
      ),
    }));
}
export function Trend({
  rows,
  lines,
  unit = "₽/л",
  height = 300,
  threshold,
  area = false,
}: {
  rows: PlotRow[];
  lines: { key: string; label: string; color?: string }[];
  unit?: string;
  height?: number;
  threshold?: number;
  area?: boolean;
}) {
  const gradient = useId().replace(/:/g, "");
  const values = rows.flatMap((r) =>
    lines.flatMap((l) =>
      typeof r[l.key] === "number" ? [r[l.key] as number] : [],
    ),
  );
  if (!values.length)
    return (
      <div className="chart-empty">За выбранный период нет наблюдений.</div>
    );
  const min = Math.min(
      ...values,
      ...(threshold === undefined ? [] : [threshold]),
    ),
    max = Math.max(...values, ...(threshold === undefined ? [] : [threshold]));
  const padding = Math.max((max - min) * 0.22, 0.3);
  return (
    <div
      className="trend"
      style={{ height }}
      role="img"
      aria-label={"График: " + lines.map((l) => l.label).join(", ")}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={rows}
          margin={{ top: 20, right: 20, bottom: 10, left: 3 }}
        >
          <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#87df50" stopOpacity={0.26}/><stop offset="100%" stopColor="#87df50" stopOpacity={0}/></linearGradient></defs>
          <CartesianGrid
            vertical={false}
            stroke="#39414d"
            strokeDasharray="2 6"
          />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => dateLabel(d)}
            tick={{ fontSize: 14, fill: "#aeb7cb" }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
            tickMargin={14}
          />
          <YAxis
            width={65}
            domain={[
              Math.floor((min - padding) * 10) / 10,
              Math.ceil((max + padding) * 10) / 10,
            ]}
            tickFormatter={(v) => fmt(v, 1)}
            tick={{ fontSize: 14, fill: "#aeb7cb" }}
            axisLine={false}
            tickLine={false}
            tickCount={4}
          />
          <Tooltip
            cursor={{ stroke: "#798394", strokeDasharray: "3 5" }}
            contentStyle={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              color: "var(--ink)",
              fontSize: 16,
              padding: 16,
            }}
            labelFormatter={(v) => dateLabel(String(v), true)}
            formatter={(v, name) => [
              typeof v === "number"
                ? fmt(v) + (unit ? " " + unit : "")
                : "Нет наблюдения",
              lines.find((l) => l.key === name)?.label || String(name),
            ]}
          />
          {threshold !== undefined && (
            <ReferenceLine
              y={threshold}
              stroke="#d9bc87"
              strokeDasharray="5 5"
            />
          )}
          {area && lines.length === 1 && <Area dataKey={lines[0].key} type="linear" fill={`url(#${gradient})`} stroke="none" isAnimationActive={false} tooltipType="none" connectNulls={false} />}
          {lines.map((l, i) => (
            <Line
              key={l.key}
              name={l.key}
              dataKey={l.key}
              type="linear"
              stroke={l.color || lineColors[i % lineColors.length]}
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#202832", strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
