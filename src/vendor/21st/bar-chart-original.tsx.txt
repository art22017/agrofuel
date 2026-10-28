'use client';

import { Bar, BarChart as RBarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartCard, { ChartTooltip } from './ChartCard';
import { axisProps, seriesColor, type ChartSeries } from './chartSeries';
import { compactNumber, useChartPalette } from './chartTheme';

/**
 * Bars for comparing magnitude across categories — grouped, stacked, or
 * horizontal for long names.
 *
 * ── Which arrangement ───────────────────────────────────────────────────────
 *
 *   grouped   the series side by side: compare series WITHIN a category
 *   stacked   one bar per category, split by series: the total is the story,
 *             the parts are its make-up (part-to-whole)
 *   horizontal  for many categories or long names, which a column chart
 *             would have to rotate or truncate
 *
 * Bars are capped at 24px and never fill the band — the leftover is air.
 * Data-ends are 4px rounded and square at the baseline; a stack rounds only
 * its top segment, and a 2px gap in the card's own colour separates touching
 * segments instead of a drawn border.
 */
export default function BarChart({
  title,
  hint,
  data,
  x,
  series,
  stacked = false,
  horizontal = false,
  format = compactNumber,
  height = 280,
  className,
}: {
  title: string;
  hint?: string;
  data: Record<string, string | number>[];
  /** The category key. */
  x: string;
  series: ChartSeries[];
  stacked?: boolean;
  /** Bars left-to-right instead of columns bottom-up. */
  horizontal?: boolean;
  format?: (v: number) => string;
  height?: number;
  className?: string;
}) {
  const p = useChartPalette();
  const axis = axisProps(p);
  const last = series.length - 1;

  return (
    <ChartCard
      title={title}
      hint={hint}
      className={className}
      empty={data.length === 0}
      legend={series.map((s, i) => ({ label: s.label, color: seriesColor(p, s, i) }))}
      table={{
        columns: [{ key: x, label: x.charAt(0).toUpperCase() + x.slice(1) }, ...series.map((s) => ({ key: s.key, label: s.label, align: 'right' as const, format: (v: unknown) => format(Number(v)) }))],
        rows: data,
      }}
    >
      <div style={{ height: horizontal ? Math.max(height, data.length * 36 + 32) : height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RBarChart
            data={data}
            layout={horizontal ? 'vertical' : 'horizontal'}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            barGap={2}
            barCategoryGap="28%"
          >
            <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke={p.grid} />
            {horizontal ? (
              <>
                <XAxis type="number" tickFormatter={format} {...axis} />
                <YAxis type="category" dataKey={x} width={96} {...axis} axisLine={false} />
              </>
            ) : (
              <>
                <XAxis dataKey={x} {...axis} />
                <YAxis tickFormatter={format} width={48} {...axis} axisLine={false} />
              </>
            )}
            <Tooltip
              cursor={{ fill: p.dark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' }}
              content={(props) => <ChartTooltip {...props} format={format} />}
            />
            {series.map((s, i) => {
              // Only the outermost segment of a stack gets the rounded end.
              const rounded = !stacked || i === last;
              const r = rounded ? 4 : 0;
              return (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={seriesColor(p, s, i)}
                  stackId={stacked ? 'stack' : undefined}
                  maxBarSize={24}
                  radius={horizontal ? [0, r, r, 0] : [r, r, 0, 0]}
                  // The 2px surface gap between touching stacked segments.
                  stroke={stacked ? p.surface : undefined}
                  strokeWidth={stacked ? 1 : 0}
                  isAnimationActive={false}
                />
              );
            })}
          </RBarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
