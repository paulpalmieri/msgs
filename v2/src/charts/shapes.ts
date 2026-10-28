// Chart builders for distributions and rankings, shared across sections.
import { baseOption, esc, tipRow, type ChartTheme } from './theme';

export type Quantiles = [p5: number, q1: number, median: number, q3: number, p95: number];

/**
 * One horizontal box per person: whiskers p5–p95, box q1–q3, line at the
 * median. Rows come in display order (top first).
 */
export function personBoxplot(t: ChartTheme, o: {
  rows: { name: string; q: Quantiles; n: number }[];
  colorOf: (name: string) => string;
  format: (v: number) => string;
  unit: string;
  log?: boolean;
  axisName?: string;
}) {
  const base = baseOption(t);
  const rows = [...o.rows].reverse(); // category axes draw bottom-up
  const floor = (v: number) => (o.log ? Math.max(v, 1e-9) : v);
  return {
    option: {
      ...base,
      grid: { ...base.grid, left: 8, right: 24, top: o.axisName ? 28 : 12, bottom: 28 },
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (p: { dataIndex: number }) => {
          const r = rows[p.dataIndex];
          return `<div style="font-weight:600;margin-bottom:4px">${esc(r.name)}</div>` +
            tipRow(o.colorOf(r.name), o.format(r.q[2]), `median ${o.unit}`) +
            tipRow(t.ink2, `${o.format(r.q[1])} – ${o.format(r.q[3])}`, 'middle half') +
            tipRow(t.muted, `${o.format(r.q[0])} – ${o.format(r.q[4])}`, '5th – 95th percentile') +
            tipRow(t.muted, r.n.toLocaleString('en-US'), 'messages');
        },
      },
      xAxis: {
        type: o.log ? 'log' : 'value', logBase: 10, ...base.axisCommon,
        name: o.axisName, nameLocation: 'end', nameGap: 8, nameTextStyle: { color: t.muted, fontSize: 11, align: 'right', verticalAlign: 'bottom', padding: [0, 0, 26, 0] },
        axisLabel: { ...base.axisCommon.axisLabel, formatter: (v: number) => o.format(v) },
      },
      yAxis: {
        type: 'category', data: rows.map((r) => r.name), ...base.axisCommon, axisLine: { show: false },
        axisLabel: {
          color: t.ink2, fontSize: rows.length > 30 ? 10 : 11, width: 130, overflow: 'truncate',
          formatter: (v: string, i: number) => `{d${i}|}  ${v}`,
          rich: Object.fromEntries(rows.map((r, i) => [`d${i}`, { backgroundColor: o.colorOf(r.name), width: 8, height: 8, borderRadius: 4 }])),
        },
      },
      series: [{
        type: 'boxplot',
        boxWidth: [6, 14],
        data: rows.map((r) => ({
          value: r.q.map(floor),
          // Translucent fill so the median line (drawn in the border colour) stays visible.
          itemStyle: { color: translucent(o.colorOf(r.name)), borderColor: o.colorOf(r.name), borderWidth: 1.5 },
        })),
      }],
    },
    height: Math.max(180, rows.length * (rows.length > 30 ? 16 : 24) + 50),
  };
}

function translucent(c: string): string {
  return /^#[0-9a-f]{6}$/i.test(c) ? `${c}40` : c;
}

/**
 * Rank over time: one line per person, rank 1 at the top, names at the end of
 * each line. People absent in a period have a gap.
 */
export function bumpChart(t: ChartTheme, o: {
  periods: string[];
  series: { name: string; ranks: (number | null)[]; values: (number | null)[] }[];
  colorOf: (name: string) => string;
  unit: string;
  maxRank: number;
}) {
  const base = baseOption(t);
  const short = shortNames(o.series.map((s) => s.name));
  return {
    ...base,
    grid: { ...base.grid, left: 16, right: 110, top: 16, bottom: 28 },
    tooltip: {
      ...base.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: t.axis } },
      formatter: (ps: { seriesName: string; value: number | null; color: string; dataIndex: number; seriesIndex: number }[]) =>
        `<div style="margin-bottom:4px;opacity:.7">${esc(o.periods[ps[0].dataIndex])}</div>` +
        ps.filter((p) => p.value != null).sort((a, b) => a.value! - b.value!)
          .map((p) => tipRow(p.color, `#${p.value}`, `${p.seriesName} · ${(o.series[p.seriesIndex].values[p.dataIndex] ?? 0).toLocaleString('en-US')} ${o.unit}`)).join(''),
    },
    xAxis: { type: 'category', data: o.periods, boundaryGap: false, ...base.axisCommon, splitLine: { show: false } },
    yAxis: {
      type: 'value', inverse: true, min: 1, max: o.maxRank, interval: o.maxRank > 30 ? 5 : 1, ...base.axisCommon, axisLine: { show: false },
      axisLabel: { ...base.axisCommon.axisLabel, formatter: (v: number) => `#${v}` }, splitLine: { show: false },
    },
    series: o.series.map((s) => {
      const last = s.ranks.findLastIndex((r) => r != null);
      return {
        name: s.name,
        type: 'line',
        smooth: 0.3,
        symbol: 'circle',
        symbolSize: o.series.length > 30 ? 6 : 9,
        connectNulls: false,
        lineStyle: { width: o.series.length > 12 ? 2 : 3, color: o.colorOf(s.name) },
        itemStyle: { color: o.colorOf(s.name), borderColor: t.surface, borderWidth: 2 },
        emphasis: { focus: 'series', lineStyle: { width: 4 } },
        endLabel: { show: last === s.ranks.length - 1, color: t.ink2, fontSize: 11, formatter: () => short.get(s.name)!, distance: 8 },
        data: s.ranks,
      };
    }),
  };
}

/** First names, plus a last initial where two people share one. */
function shortNames(names: string[]): Map<string, string> {
  const first = (n: string) => n.split(' ')[0];
  const count = new Map<string, number>();
  for (const n of names) count.set(first(n), (count.get(first(n)) ?? 0) + 1);
  return new Map(names.map((n) => {
    const parts = n.split(' ');
    return [n, count.get(parts[0])! > 1 && parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0]];
  }));
}

/** Ranks within each period (1 = most), from values per person. */
export function ranksPerPeriod(values: Map<string, (number | null)[]>, periods: number): Map<string, (number | null)[]> {
  const out = new Map<string, (number | null)[]>();
  for (const name of values.keys()) out.set(name, new Array(periods).fill(null));
  for (let i = 0; i < periods; i++) {
    const present = [...values].filter(([, v]) => v[i] != null && v[i]! > 0).sort((a, b) => b[1][i]! - a[1][i]!);
    present.forEach(([name], r) => (out.get(name)![i] = r + 1));
  }
  return out;
}
