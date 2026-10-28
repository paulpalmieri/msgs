import { baseOption, esc, tipRow, type ChartTheme } from './theme';

/**
 * Category × category heatmap on the sequential ramp. `cells` are
 * [xIndex, yIndex, value]; `max` caps the colour scale (pass a high
 * percentile so one outlier doesn't flatten everything else).
 */
export function gridHeatmap(t: ChartTheme, o: {
  x: string[];
  y: string[];
  cells: [number, number, number][];
  max?: number;
  /** Tooltip heading for a cell, and how its value reads. */
  title: (x: string, y: string) => string;
  value: (v: number) => string;
  legend?: [string, string];
  labelWidth?: number;
  /** Axis captions, for matrices ("replied to →"). */
  xName?: string;
  yName?: string;
  /** Rotate x labels (long names). */
  xRotate?: number;
  /** Colour per y row, drawn as a dot before the label (person rows). */
  yColors?: string[];
}) {
  const base = baseOption(t);
  const max = o.max ?? Math.max(1, ...o.cells.map((c) => c[2]));
  return {
    ...base,
    grid: { ...base.grid, top: o.yName ? 24 : 8, bottom: 40 },
    tooltip: {
      ...base.tooltip,
      trigger: 'item',
      formatter: (p: { value: [number, number, number] }) =>
        `<div style="margin-bottom:4px;opacity:.7">${esc(o.title(o.x[p.value[0]], o.y[p.value[1]]))}</div>` + tipRow(t.series[0], o.value(p.value[2]), ''),
    },
    xAxis: {
      type: 'category', data: o.x, ...base.axisCommon, splitLine: { show: false }, axisLine: { show: false },
      axisLabel: { ...base.axisCommon.axisLabel, interval: 0, rotate: o.xRotate ?? 0, width: 90, overflow: 'truncate' },
      name: o.xName, nameLocation: 'middle', nameGap: o.xRotate ? 70 : 26, nameTextStyle: { color: t.muted, fontSize: 11 },
    },
    yAxis: {
      type: 'category', data: o.y, ...base.axisCommon, axisLine: { show: false },
      axisLabel: {
        color: t.ink2, fontSize: o.y.length > 40 ? 10 : 11, width: o.labelWidth ?? 130, overflow: 'truncate',
        ...(o.yColors && {
          formatter: (v: string, i: number) => `{d${i}|}  ${v}`,
          rich: Object.fromEntries(o.yColors.map((c, i) => [`d${i}`, { backgroundColor: c, width: 8, height: 8, borderRadius: 4 }])),
        }),
      },
      name: o.yName, nameLocation: 'end', nameTextStyle: { color: t.muted, fontSize: 11, align: 'left' },
    },
    visualMap: {
      min: 0, max, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 120, itemWidth: 10,
      text: o.legend ?? [o.value(max), o.value(0)], textStyle: { color: t.muted, fontSize: 10 }, inRange: { color: t.seq.slice(1) },
    },
    series: [{
      type: 'heatmap',
      data: o.cells,
      itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 3 },
      emphasis: { itemStyle: { borderColor: t.ink, borderWidth: 1 } },
    }],
  };
}

/** Value at quantile q (0–1) of a list, for capping colour scales. */
export function quantile(values: number[], q: number): number {
  if (!values.length) return 1;
  const s = [...values].sort((a, b) => a - b);
  return Math.max(1, s[Math.min(s.length - 1, Math.floor(q * s.length))]);
}

/** Row height for a heatmap with n person rows, tighter as groups grow. */
export function rowHeight(n: number): number {
  return n > 40 ? 16 : n > 20 ? 20 : 26;
}

/**
 * Person × category heatmap: one row per person (everyone, in slot order),
 * values as given or as a share of each row ("row %").
 */
export function personHeatmap(t: ChartTheme, o: {
  people: string[];
  colorOf: (name: string) => string;
  x: string[];
  values: Map<string, number[]>;
  rowShare?: boolean;
  title: (x: string, person: string) => string;
  value: (v: number) => string;
  legend?: [string, string];
  /** Map a value to its colour position (e.g. log scale); defaults to the value. */
  scale?: (v: number) => number;
}) {
  const people = o.people.filter((p) => o.values.has(p));
  const rows = [...people].reverse();
  const cells: [number, number, number][] = [];
  const raw = new Map<string, number>();
  rows.forEach((p, yi) => {
    const arr = o.values.get(p)!;
    const total = arr.reduce((a, b) => a + (b ?? 0), 0) || 1;
    arr.forEach((v, xi) => {
      if (v == null || (!v && o.rowShare)) return;
      const shown = o.rowShare ? (v / total) * 100 : v;
      raw.set(`${xi}:${yi}`, shown);
      cells.push([xi, yi, o.scale ? o.scale(shown) : shown]);
    });
  });
  const opt = gridHeatmap(t, {
    x: o.x,
    y: rows,
    cells,
    max: quantile(cells.map((c) => c[2]), 0.97),
    title: (x, y) => o.title(x, y),
    value: o.value,
    legend: o.legend,
    labelWidth: 130,
    yColors: rows.map(o.colorOf),
  });
  // Tooltips show the real value even when the colour uses a transformed scale.
  opt.tooltip.formatter = (p: { value: [number, number, number] }) =>
    `<div style="margin-bottom:4px;opacity:.7">${esc(o.title(o.x[p.value[0]], rows[p.value[1]]))}</div>` +
    tipRow(o.colorOf(rows[p.value[1]]), o.value(raw.get(`${p.value[0]}:${p.value[1]}`) ?? p.value[2]), '');
  if (o.scale) opt.visualMap.text = o.legend ?? ['slower', 'faster'];
  return { option: opt, rows, height: Math.max(200, rows.length * rowHeight(rows.length) + 70) };
}
