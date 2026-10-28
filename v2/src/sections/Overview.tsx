// Overview: volumes and who carries the conversation.
// Click any mark to read its messages in the inspector; ⇧-click filters.
import type { ECharts } from 'echarts';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useConversation } from '../app/ConversationProvider';
import { EChart } from '../charts/EChart';
import { bumpChart, ranksPerPeriod } from '../charts/shapes';
import { baseOption, esc, legend, tipRow, useChartTheme } from '../charts/theme';
import { lit } from '../db/duckdb';
import { useQuery } from '../db/useQuery';
import { fmtCompact, fmtDate, fmtInt, fmtPct } from '../lib/format';
import { DAY, isoDay, MONTHS, tsLit, utc } from '../lib/time';
import { Panel, Segmented, Stat } from '../ui/primitives';
import { Sparkline } from '../ui/Sparkline';
import { Badge } from '../ui/Badge';
import { Play } from 'lucide-react';
import { RankRace } from './RankRace';

type Grain = 'day' | 'week' | 'month' | 'quarter' | 'year';
const GRAINS: Grain[] = ['day', 'week', 'month', 'quarter', 'year'];
const STEP: Record<Grain, string> = { day: '1 DAY', week: '7 DAY', month: '1 MONTH', quarter: '3 MONTH', year: '1 YEAR' };

function bucketLabel(ms: number, g: Grain): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  if (g === 'year') return String(y);
  if (g === 'quarter') return `Q${Math.floor(m / 3) + 1} ${y}`;
  if (g === 'month') return `${MONTHS[m]} ${y}`;
  return `${d.getUTCDate()} ${MONTHS[m]} ${y}`;
}

function autoGrain(spanDays: number): Grain {
  if (spanDays < 120) return 'day';
  if (spanDays < 3 * 365) return 'week';
  return 'month';
}

/** The selected date range, clamped to the conversation (epoch ms of wall-clock days). */
export function useSelectedRange(): [number, number] {
  const { conv, filters } = useConversation();
  const from = filters.from ? Math.max(conv.firstTs, Date.parse(filters.from)) : conv.firstTs;
  const to = filters.to ? Math.min(conv.lastTs, Date.parse(filters.to) + DAY - 1) : conv.lastTs;
  return [from, Math.max(from, to)];
}

/**
 * Dense bucket starts plus counts per series. `ctx` spans the whole
 * conversation (the timeline you brush on); `sel` only the selected range.
 */
function useSeriesByBucket(grain: Grain, source: 'ctx' | 'sel') {
  const { seriesSql } = useConversation();
  const [from, to] = useSelectedRange();
  const bounds = source === 'ctx' ? ['(SELECT min(ts) FROM conv)', '(SELECT max(ts) FROM conv)'] : [`TIMESTAMP '${utc(from)}'`, `TIMESTAMP '${utc(to)}'`];
  const buckets = useQuery<{ b: number }>(`
    SELECT epoch_ms(range) AS b FROM range(
      date_trunc('${grain}', ${bounds[0]}),
      ${bounds[1]} + INTERVAL ${STEP[grain]},
      INTERVAL ${STEP[grain]})`);
  const counts = useQuery<{ b: number; s: string; n: number }>(`
    SELECT epoch_ms(date_trunc('${grain}', ts)) AS b, ${seriesSql} AS s, count(*) AS n FROM ${source} GROUP BY 1, 2`);
  return useMemo(() => {
    if (!buckets.data || !counts.data) return null;
    const index = new Map(buckets.data.map((r, i) => [r.b, i]));
    const bySeries = new Map<string, number[]>();
    for (const r of counts.data) {
      let arr = bySeries.get(r.s);
      if (!arr) bySeries.set(r.s, (arr = new Array(buckets.data.length).fill(0)));
      const i = index.get(r.b);
      if (i !== undefined) arr[i] = r.n;
    }
    return { starts: buckets.data.map((r) => r.b), bySeries, loading: counts.loading };
  }, [buckets.data, counts.data, counts.loading]);
}

// --- KPIs -------------------------------------------------------------------

type Kpis = {
  messages: number; mine: number; active_days: number; senders: number; words: number; media: number;
  reactions: number; calls: number; call_secs: number; first_ts: number | null; last_ts: number | null;
};

const KPI_SQL = `count(*) AS messages, count(*) FILTER (is_me) AS mine, count(DISTINCT ts::DATE) AS active_days,
  count(DISTINCT sender) AS senders, coalesce(sum(words), 0) AS words,
  count(*) FILTER (kind IN ('photo','video','gif','sticker','audio','file')) AS media,
  coalesce(sum(n_reactions), 0) AS reactions, count(*) FILTER (kind = 'call') AS calls,
  coalesce(sum(call_duration), 0) AS call_secs, epoch_ms(min(ts)) AS first_ts, epoch_ms(max(ts)) AS last_ts`;

function KpiRow() {
  const { conv, filters } = useConversation();
  const [from, to] = useSelectedRange();
  const k = useQuery<Kpis>(`SELECT ${KPI_SQL} FROM sel`).data?.[0];
  // With a date filter, compare to the period of the same length just before it.
  const ranged = !!(filters.from || filters.to);
  const len = to - from + 1;
  const prev = useQuery<Kpis>(ranged ? `SELECT ${KPI_SQL} FROM ctx WHERE ts >= ${tsLit(from - len)} AND ts < ${tsLit(from)}` : null).data?.[0];
  const unit = (to - from) / DAY > 120 ? 'month' : 'week';
  const trend = useQuery<{ b: number } & Kpis>(`SELECT epoch_ms(date_trunc('${unit}', ts)) AS b, ${KPI_SQL} FROM sel GROUP BY 1 ORDER BY 1`).data ?? [];
  const series = (key: keyof Kpis) => trend.map((r) => Number(r[key] ?? 0));
  const delta = (key: keyof Kpis) => (ranged && prev && Number(prev[key]) > 0 && k ? Number(k[key]) / Number(prev[key]) - 1 : null);
  const span = k?.first_ts != null && k.last_ts != null ? Math.floor((k.last_ts - k.first_ts) / DAY) + 1 : null;
  const hasMe = conv.people.some((p) => p.isMe);
  return (
    <div className="grid grid-cols-4 gap-3 @5xl:grid-cols-8">
      <Stat label="Messages" value={fmtInt(k?.messages)} trend={series('messages')} delta={delta('messages')} sub={k && k.active_days ? `${(k.messages / k.active_days).toFixed(1)} per active day` : undefined} />
      <Stat label="Active days" value={fmtInt(k?.active_days)} trend={series('active_days')} delta={delta('active_days')} sub={k && span ? `${fmtPct(k.active_days / span, 0)} of ${fmtInt(span)} days` : undefined} />
      <Stat label="People" value={fmtInt(k?.senders)} trend={series('senders')} delta={delta('senders')} sub={`of ${fmtInt(conv.participantCount)} members`} />
      <Stat label="Words" value={fmtCompact(k?.words)} trend={series('words')} delta={delta('words')} sub={k && k.messages ? `${(k.words / k.messages).toFixed(1)} per message` : undefined} />
      <Stat label="Media" value={fmtInt(k?.media)} trend={series('media')} delta={delta('media')} sub={k && k.messages ? `${fmtPct(k.media / k.messages)} of messages` : undefined} />
      <Stat label="Reactions" value={fmtInt(k?.reactions)} trend={series('reactions')} delta={delta('reactions')} sub={k && k.messages ? `${((k.reactions / k.messages) * 100).toFixed(1)} per 100 messages` : undefined} />
      <Stat label="Calls" value={fmtInt(k?.calls)} trend={series('calls')} delta={delta('calls')} sub={k ? `${(k.call_secs / 3600).toFixed(1)} h in total` : undefined} />
      <Stat label="Your share" value={hasMe && k?.messages ? fmtPct(k.mine / k.messages) : '–'} trend={hasMe ? trend.map((r) => (r.messages ? r.mine / r.messages : 0)) : undefined} sub={hasMe ? `${fmtInt(k?.mine)} sent by you` : 'you are not in this one'} />
    </div>
  );
}

// --- Timeline ---------------------------------------------------------------

function Timeline() {
  const t = useChartTheme();
  const { conv, filters, setFilters, seriesNames, colorOf, inspect } = useConversation();
  const [grain, setGrain] = useState<Grain>(() => autoGrain((conv.lastTs - conv.firstTs) / DAY));
  // Past 8 people, 20+ thin stripes are noise: start with the total.
  const [mode, setMode] = useState<'total' | 'people'>(() => (seriesNames.length > 8 ? 'total' : 'people'));
  const data = useSeriesByBucket(grain, 'ctx');

  const option = useMemo(() => {
    if (!data) return null;
    const base = baseOption(t);
    const labels = data.starts.map((b) => bucketLabel(b, grain));
    // Indexes of the buckets covering the active date filter, for the shaded band.
    const fromMs = filters.from ? Date.parse(filters.from) : null;
    const toMs = filters.to ? Date.parse(filters.to) : null;
    const i0 = fromMs === null ? 0 : Math.max(0, data.starts.findLastIndex((b) => b <= fromMs));
    const i1 = toMs === null ? labels.length - 1 : Math.max(0, data.starts.findLastIndex((b) => b <= toMs));
    const ranged = fromMs !== null || toMs !== null;
    const people = seriesNames.filter((s) => data.bySeries.has(s));
    const total = data.starts.map((_, i) => people.reduce((n, s) => n + data.bySeries.get(s)![i], 0));
    const names = mode === 'total' ? ['All messages'] : people;
    const valuesOf = (s: string) => (mode === 'total' ? total : data.bySeries.get(s));
    const colorFor = (s: string) => (mode === 'total' ? t.ink2 : colorOf(s));
    return {
      ...base,
      grid: { ...base.grid, top: mode === 'total' ? 16 : 36, bottom: 40 },
      legend: mode === 'total' ? { show: false } : legend(t, names),
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: t.brush } },
        formatter: (ps: { seriesName: string; value: number; color: string; dataIndex: number }[]) => {
          const rows = ps.filter((p) => p.value > 0).sort((a, b) => b.value - a.value);
          const total = rows.reduce((n, p) => n + p.value, 0);
          return `<div style="margin-bottom:4px;opacity:.7">${esc(bucketLabel(data.starts[ps[0].dataIndex], grain))}</div>` +
            tipRow(t.ink2, fmtInt(total), 'total') + rows.slice(0, 12).map((p) => tipRow(p.color, fmtInt(p.value), p.seriesName)).join('') +
            (rows.length > 12 ? `<div style="opacity:.6;margin-top:2px">and ${rows.length - 12} more</div>` : '');
        },
      },
      xAxis: { type: 'category', data: labels, ...base.axisCommon, splitLine: { show: false } },
      yAxis: { type: 'value', ...base.axisCommon, axisLine: { show: false } },
      dataZoom: [
        { type: 'inside', zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false, moveOnMouseMove: false },
        { type: 'slider', height: 18, bottom: 6, borderColor: t.grid, fillerColor: t.brush, textStyle: { color: t.muted, fontSize: 10 }, dataBackground: { lineStyle: { color: t.axis }, areaStyle: { color: t.grid } } },
      ],
      toolbox: { show: false, feature: { brush: { type: ['lineX'] } } },
      brush: { xAxisIndex: 0, brushType: 'lineX', brushMode: 'single', transformable: false, brushStyle: { color: t.brush, borderColor: t.series[0], borderWidth: 1 } },
      series: names.map((s, idx) => ({
        name: s,
        type: 'bar',
        stack: 'all',
        large: labels.length > 600,
        barCategoryGap: labels.length > 200 ? '10%' : '25%',
        itemStyle: { color: colorFor(s), opacity: mode === 'total' ? 0.75 : 1, borderRadius: idx === names.length - 1 ? [2, 2, 0, 0] : 0 },
        emphasis: { focus: 'series' },
        data: valuesOf(s),
        ...(idx === 0 && ranged
          ? { markArea: { silent: true, itemStyle: { color: t.brush }, data: [[{ xAxis: labels[i0] }, { xAxis: labels[i1] }]] } }
          : {}),
      })),
    };
  }, [data, grain, t, seriesNames, colorOf, filters.from, filters.to, mode]);

  const bucketEnd = (i: number) => (data!.starts[i + 1] ?? data!.starts[i] + DAY) - DAY;
  const lastBrush = useRef(0);
  // Bars can be 1-2px wide, so a click anywhere in a column inspects that period.
  const inspectColumn = useRef<(px: [number, number]) => void>(() => undefined);
  inspectColumn.current = (px) => {
    if (!data || !chartRef.current || Date.now() - lastBrush.current < 400) return;
    const c = chartRef.current;
    if (!c.containPixel({ gridIndex: 0 }, px)) return;
    const [x] = c.convertFromPixel({ gridIndex: 0 }, px) as number[];
    const i = Math.round(x);
    if (!Number.isFinite(i) || i < 0 || i >= data.starts.length) return;
    const start = data.starts[i];
    const end = data.starts[i + 1] ?? start + DAY;
    inspect({ title: bucketLabel(start, grain), where: `ts >= TIMESTAMP '${utc(start)}' AND ts < TIMESTAMP '${utc(end)}'`, from: 'ctx' });
  };
  const chartRef = useRef<ECharts | null>(null);
  const armBrush = (c: ECharts) => {
    chartRef.current = c;
    c.dispatchAction({ type: 'takeGlobalCursor', key: 'brush', brushOption: { brushType: 'lineX', brushMode: 'single' } });
    c.getZr().off('click');
    c.getZr().on('click', (e: { offsetX: number; offsetY: number }) => inspectColumn.current([e.offsetX, e.offsetY]));
  };

  return (
    <Panel
      title="Messages over time"
      actions={
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-ink-3">{filters.from || filters.to ? 'Whole history, selection shaded' : 'Drag to filter dates'} · click a period to read · pinch or ⌃-scroll to zoom</span>
          <Segmented value={mode} options={[['total', 'Total'], ['people', 'By person']]} onChange={setMode} />
          <Segmented value={grain} options={GRAINS.map((g) => [g, g[0].toUpperCase() + g.slice(1)] as [Grain, string])} onChange={setGrain} />
        </div>
      }
      bodyClassName="p-2"
    >
      {option && (
        <EChart
          option={option}
          height={300}
          dimmed={data?.loading}
          onReady={armBrush}
          on={{
            brushEnd: (p: { areas?: { coordRange: [number, number] }[] }) => {
              const r = p.areas?.[0]?.coordRange;
              if (!r || !data) return;
              lastBrush.current = Date.now();
              const [a, b] = [Math.max(0, r[0]), Math.min(data.starts.length - 1, r[1])];
              setFilters({ ...filters, from: isoDay(data.starts[a]), to: isoDay(bucketEnd(b)) });
            },
          }}
        />
      )}
    </Panel>
  );
}

// --- Share of voice -----------------------------------------------------------

type Voice = { sender: string; n: number; words: number; media: number };

function ShareOfVoice() {
  const t = useChartTheme();
  const { filters, setFilters, colorOf, inspect } = useConversation();
  const q = useQuery<Voice>(`
    SELECT sender, count(*) AS n, coalesce(sum(words), 0) AS words,
           count(*) FILTER (kind IN ('photo','video','gif','sticker','audio','file')) AS media
    FROM sel GROUP BY 1 ORDER BY n DESC`);
  const rows = q.data ?? [];
  const total = rows.reduce((n, r) => n + r.n, 0);

  const option = useMemo(() => {
    const base = baseOption(t);
    const ordered = [...rows].reverse();
    return {
      ...base,
      grid: { ...base.grid, right: 96 },
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (p: { dataIndex: number }) => {
          const r = ordered[p.dataIndex];
          return `<div style="margin-bottom:4px;font-weight:600">${esc(r.sender)}</div>` +
            tipRow(colorOf(r.sender), fmtInt(r.n), `messages · ${fmtPct(r.n / total)}`) +
            tipRow(t.ink2, fmtInt(r.words), `words · ${(r.words / r.n).toFixed(1)} per message`) +
            tipRow(t.ink2, fmtInt(r.media), 'media');
        },
      },
      xAxis: { type: 'value', ...base.axisCommon, axisLabel: { show: false }, splitLine: { show: false } },
      yAxis: { type: 'category', data: ordered.map((r) => r.sender), ...base.axisCommon, axisLine: { show: false }, axisLabel: { color: t.ink2, fontSize: 11, width: 130, overflow: 'truncate' } },
      series: [{
        type: 'bar',
        barMaxWidth: 16,
        data: ordered.map((r) => ({ value: r.n, itemStyle: { color: colorOf(r.sender), borderRadius: [0, 3, 3, 0] } })),
        label: { show: true, position: 'right', color: t.ink2, fontSize: 11, formatter: (p: { value: number }) => `${fmtInt(p.value)} · ${fmtPct(p.value / total, 0)}` },
      }],
    };
  }, [rows, total, t, colorOf]);

  return (
    <Panel title="Share of messages" actions={<span className="text-[11px] text-ink-3">click to read · ⇧-click to filter</span>} bodyClassName="p-2">
      <EChart
        option={option}
        height={Math.max(160, rows.length * 24 + 24)}
        dimmed={q.loading}
        on={{
          click: (p: { dataIndex: number; event: { event: MouseEvent } }) => {
            const r = [...rows].reverse()[p.dataIndex];
            if (p.event.event.shiftKey) setFilters({ ...filters, people: [r.sender] });
            else inspect({ title: `Messages from ${r.sender}`, where: `sender = ${lit(r.sender)}` });
          },
        }}
      />
    </Panel>
  );
}

// --- Share over time -----------------------------------------------------------

function ShareOverTime() {
  const t = useChartTheme();
  const { seriesNames, colorOf } = useConversation();
  const [from, to] = useSelectedRange();
  const days = (to - from) / DAY;
  // Coarse enough that each period has a meaningful split, fine enough to show change.
  const grain: Grain = days <= 45 ? 'day' : days <= 400 ? 'week' : days <= 6 * 365 ? 'month' : 'quarter';
  const data = useSeriesByBucket(grain, 'sel');

  const option = useMemo(() => {
    if (!data) return null;
    const base = baseOption(t);
    const names = seriesNames.filter((s) => data.bySeries.has(s));
    const totals = data.starts.map((_, i) => names.reduce((n, s) => n + data.bySeries.get(s)![i], 0));
    return {
      ...base,
      grid: { ...base.grid, top: 36 },
      legend: legend(t, names),
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: t.axis } },
        formatter: (ps: { seriesName: string; value: number | null; color: string; dataIndex: number }[]) => {
          const i = ps[0].dataIndex;
          const rows = ps.filter((p) => p.value).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
          return `<div style="margin-bottom:4px;opacity:.7">${esc(bucketLabel(data.starts[i], grain))} · ${fmtInt(totals[i])} messages</div>` +
            rows.slice(0, 10).map((p) => tipRow(p.color, `${(p.value ?? 0).toFixed(0)}%`, p.seriesName)).join('');
        },
      },
      xAxis: { type: 'category', boundaryGap: false, data: data.starts.map((b) => bucketLabel(b, grain)), ...base.axisCommon, splitLine: { show: false } },
      yAxis: { type: 'value', max: 100, ...base.axisCommon, axisLine: { show: false }, axisLabel: { ...base.axisCommon.axisLabel, formatter: '{value}%' } },
      series: names.map((s) => ({
        name: s,
        type: 'line',
        stack: 'share',
        symbol: 'none',
        lineStyle: { width: 0 },
        areaStyle: { color: colorOf(s), opacity: 0.9 },
        itemStyle: { color: colorOf(s) },
        // Empty periods stay empty rather than showing a fake 0/0 split.
        data: data.bySeries.get(s)!.map((v, i) => (totals[i] ? (v / totals[i]) * 100 : null)),
      })),
    };
  }, [data, grain, t, seriesNames, colorOf]);

  return (
    <Panel title={`Share of messages by ${grain}`} bodyClassName="p-2">
      {option && <EChart option={option} height={260} dimmed={data?.loading} />}
    </Panel>
  );
}

// --- Person × year ------------------------------------------------------------

const BUMP_TOP = 15;

/** Few enough periods that the lines stay readable (roughly 4–25). */
function bumpGrain(spanDays: number): Grain {
  if (spanDays > 4 * 365) return 'year';
  if (spanDays > 540) return 'quarter';
  if (spanDays > 120) return 'month';
  if (spanDays > 21) return 'week';
  return 'day';
}

/** Start of the period holding `ms`, matching DuckDB's date_trunc (weeks start Monday). */
function truncate(ms: number, g: Grain): number {
  const d = new Date(ms);
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  if (g === 'year') return Date.UTC(y, 0, 1);
  if (g === 'quarter') return Date.UTC(y, m - (m % 3), 1);
  if (g === 'month') return Date.UTC(y, m, 1);
  const day = Date.UTC(y, m, d.getUTCDate());
  return g === 'week' ? day - ((d.getUTCDay() + 6) % 7) * DAY : day;
}

function nextBucket(ms: number, g: Grain): number {
  const d = new Date(ms);
  if (g === 'year') return Date.UTC(d.getUTCFullYear() + 1, 0, 1);
  if (g === 'quarter') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1);
  if (g === 'month') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  return ms + (g === 'week' ? 7 : 1) * DAY;
}

/** Who wrote the most each year, as ranks: crossing lines show who rose and fell. */
function PersonYearBump() {
  const t = useChartTheme();
  const [racing, setRacing] = useState(false);
  const closeRace = useCallback(() => setRacing(false), []);
  const [limit, setLimit] = useState<'top' | 'all'>('top');
  const { seriesNames, seriesWhere, inspect, colorOf } = useConversation();
  const [from, to] = useSelectedRange();
  // The period follows the selected range: years for the whole history,
  // months for the last year, days for a couple of weeks.
  const grain = bumpGrain((to - from) / DAY);
  const periods = useMemo(() => {
    const out: number[] = [];
    for (let b = truncate(from, grain); b <= to; b = nextBucket(b, grain)) out.push(b);
    return out;
  }, [from, to, grain]);
  const q = useQuery<{ s: string; b: number; n: number }>(
    `SELECT sender AS s, epoch_ms(date_trunc('${grain}', ts)) AS b, count(*) AS n FROM sel GROUP BY 1, 2`,
  );
  const { option, shown } = useMemo(() => {
    const index = new Map(periods.map((b, i) => [b, i]));
    const values = new Map<string, (number | null)[]>();
    for (const r of q.data ?? []) {
      const i = index.get(r.b);
      if (i === undefined) continue; // a stale result from the previous grain
      let arr = values.get(r.s);
      if (!arr) values.set(r.s, (arr = new Array(periods.length).fill(null)));
      arr[i] = r.n;
    }
    const totals = [...values].map(([n, v]) => [n, v.reduce<number>((a, b) => a + (b ?? 0), 0)] as const).sort((a, b) => b[1] - a[1]);
    const top = (limit === 'all' ? totals : totals.slice(0, BUMP_TOP)).filter(([, v]) => v > 0);
    const shown = seriesNames.filter((n) => top.some(([m]) => m === n));
    // Rank among the people drawn, so ranks run 1..N with no holes.
    const ranks = ranksPerPeriod(new Map(shown.map((n) => [n, values.get(n)!])), periods.length);
    const maxRank = Math.max(2, ...shown.flatMap((n) => ranks.get(n)!.filter((r): r is number => r != null)));
    return {
      shown,
      option: bumpChart(t, {
        periods: periods.map((b) => bucketLabel(b, grain)),
        series: shown.map((n) => ({ name: n, ranks: ranks.get(n)!, values: values.get(n)! })),
        colorOf, unit: 'messages', maxRank,
      }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, seriesNames, colorOf, t, periods, limit]);
  if (periods.length < 2) return null;
  return (
    <Panel
      title={`Who led each ${grain}`}
      actions={
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-ink-3">{`rank by messages per ${grain} · hover a line to follow it · click a point to read`}</span>
          {seriesNames.length > BUMP_TOP && (
            <Segmented value={limit} options={[['top', `Top ${BUMP_TOP}`], ['all', `All ${seriesNames.length}`]]} onChange={setLimit} />
          )}
          <button onClick={() => setRacing(true)} className="inline-flex h-6 items-center gap-1.5 rounded-md bg-accent px-2.5 text-[11px] font-medium text-white hover:opacity-90" title="Animate month by month, full screen">
            <Play size={11} fill="currentColor" /> Play
          </button>
        </div>
      }
      bodyClassName="p-2"
    >
      <EChart
        option={option}
        height={Math.max(220, shown.length * (shown.length > 30 ? 16 : 26) + 60)}
        dimmed={q.loading}
        on={{
          click: (p: { seriesName: string; dataIndex: number }) =>
            inspect({
              title: `${p.seriesName} · ${bucketLabel(periods[p.dataIndex], grain)}`,
              where: `date_trunc('${grain}', ts) = ${tsLit(periods[p.dataIndex])} AND ${seriesWhere(p.seriesName)}`,
            }),
        }}
      />
      {racing && <RankRace onClose={closeRace} />}
    </Panel>
  );
}

// --- People table -----------------------------------------------------------------

type PersonRow = {
  sender: string; n: number; words: number; avg_words: number; media: number; links: number;
  received: number; given: number; days: number; first_ts: number; last_ts: number;
};
type SortKey = Exclude<keyof PersonRow, 'sender'> | 'sender';

function PeopleTable() {
  const { inspect } = useConversation();
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'n', desc: true });
  const q = useQuery<PersonRow>(`
    WITH m AS (
      SELECT sender, count(*) AS n, coalesce(sum(words), 0) AS words, avg(words) FILTER (kind = 'text') AS avg_words,
             count(*) FILTER (kind IN ('photo','video','gif','sticker','audio','file')) AS media,
             count(*) FILTER (kind = 'link') AS links, count(DISTINCT ts::DATE) AS days,
             epoch_ms(min(ts)) AS first_ts, epoch_ms(max(ts)) AS last_ts
      FROM sel GROUP BY 1
    ),
    rec AS (SELECT receiver AS sender, count(*) AS received FROM sel_reactions GROUP BY 1),
    giv AS (SELECT actor AS sender, count(*) AS given FROM sel_reactions GROUP BY 1)
    SELECT m.*, coalesce(rec.received, 0) AS received, coalesce(giv.given, 0) AS given
    FROM m LEFT JOIN rec USING (sender) LEFT JOIN giv USING (sender)`);
  const rows = useMemo(() => {
    const out = [...(q.data ?? [])];
    out.sort((a, b) => {
      const va = a[sort.key], vb = b[sort.key];
      const c = typeof va === 'string' ? va.localeCompare(vb as string) : ((va as number) ?? 0) - ((vb as number) ?? 0);
      return sort.desc ? -c : c;
    });
    return out;
  }, [q.data, sort]);
  const total = rows.reduce((n, r) => n + r.n, 0);

  const cols: [SortKey, string][] = [
    ['sender', 'Person'], ['n', 'Messages'], ['words', 'Words'], ['avg_words', 'Words/msg'], ['media', 'Media'], ['links', 'Links'],
    ['received', 'Reactions got'], ['given', 'Reactions given'], ['days', 'Active days'], ['first_ts', 'First'], ['last_ts', 'Last'],
  ];
  return (
    <Panel title="People in this selection" actions={<span className="text-[11px] text-ink-3">{rows.length} people · click a row to read</span>}>
      <div className={`max-h-[420px] overflow-auto transition-opacity ${q.loading ? 'opacity-50' : ''}`}>
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-surface">
            <tr>
              {cols.map(([k, label]) => (
                <th key={k} className={`cursor-pointer whitespace-nowrap border-b border-line px-3 py-1.5 font-medium hover:text-ink ${sort.key === k ? 'text-ink' : 'text-ink-3'} ${k === 'sender' ? 'text-left' : 'text-right'}`}
                  onClick={() => setSort((s) => ({ key: k, desc: s.key === k ? !s.desc : k !== 'sender' }))}>
                  {label}{sort.key === k ? (sort.desc ? ' ↓' : ' ↑') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sender} className="cursor-pointer hover:bg-surface-2" onClick={() => inspect({ title: `Messages from ${r.sender}`, where: `sender = ${lit(r.sender)}` })}>
                <td className="max-w-56 truncate border-b border-line/60 px-3 py-1">
                  <Badge name={r.sender} className="mr-2 align-middle" />
                  {r.sender}
                </td>
                <td className="num border-b border-line/60 px-3 text-right">{fmtInt(r.n)} <span className="text-ink-3">{fmtPct(r.n / total, 0)}</span></td>
                <td className="num border-b border-line/60 px-3 text-right">{fmtInt(r.words)}</td>
                <td className="num border-b border-line/60 px-3 text-right">{r.avg_words?.toFixed(1) ?? '–'}</td>
                <td className="num border-b border-line/60 px-3 text-right">{fmtInt(r.media)}</td>
                <td className="num border-b border-line/60 px-3 text-right">{fmtInt(r.links)}</td>
                <td className="num border-b border-line/60 px-3 text-right">{fmtInt(r.received)}</td>
                <td className="num border-b border-line/60 px-3 text-right">{fmtInt(r.given)}</td>
                <td className="num border-b border-line/60 px-3 text-right">{fmtInt(r.days)}</td>
                <td className="num whitespace-nowrap border-b border-line/60 px-3 text-right text-ink-2">{fmtDate(r.first_ts)}</td>
                <td className="num whitespace-nowrap border-b border-line/60 px-3 text-right text-ink-2">{fmtDate(r.last_ts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// --- Everyone: one small card per person -------------------------------------------

type Card = { sender: string; n: number; words: number; first_ts: number; last_ts: number; peak: number; got: number };

function EveryoneGrid({ openPerson }: { openPerson: (name: string) => void }) {
  const { colorOf, seriesNames } = useConversation();
  const [from, to] = useSelectedRange();
  const [q, setQ] = useState('');
  const cards = useQuery<Card>(`
    SELECT sender, count(*) AS n, coalesce(sum(words), 0) AS words, epoch_ms(min(ts)) AS first_ts, epoch_ms(max(ts)) AS last_ts,
           mode(hour(ts)) AS peak, coalesce(sum(n_reactions), 0) AS got
    FROM sel GROUP BY 1`);
  // Activity over the selected range, on a shared axis so sparklines line up across cards;
  // weekly bins for short ranges, monthly otherwise.
  const unit = (to - from) / DAY <= 400 ? 'week' : 'month';
  const months = useQuery<{ sender: string; i: number; n: number }>(`
    SELECT sender, date_diff('${unit}', date_trunc('${unit}', TIMESTAMP '${utc(from)}'), date_trunc('${unit}', ts))::INTEGER AS i, count(*) AS n
    FROM sel GROUP BY 1, 2`);
  const span = unit === 'week'
    ? Math.floor((to - from) / (7 * DAY)) + 2
    : (() => { const a = new Date(from), b = new Date(to); return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() + 1; })();
  const series = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const r of months.data ?? []) {
      let arr = m.get(r.sender);
      if (!arr) m.set(r.sender, (arr = new Array(span).fill(0)));
      if (r.i >= 0 && r.i < span) arr[r.i] = r.n;
    }
    return m;
  }, [months.data, span]);
  const total = (cards.data ?? []).reduce((a, r) => a + r.n, 0);
  const byName = new Map((cards.data ?? []).map((c) => [c.sender, c]));
  const shown = seriesNames.filter((n) => byName.has(n) && n.toLowerCase().includes(q.toLowerCase()));
  return (
    <Panel
      title={`Everyone · ${byName.size} people`}
      actions={
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-ink-3">sparkline = messages per {unit} in the selection · click for a profile</span>
          {byName.size > 12 && (
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find…" className="h-6 w-36 rounded border border-line bg-surface-2 px-2 text-[12px] outline-none focus:border-accent" />
          )}
        </div>
      }
    >
      <div className={`grid grid-cols-2 gap-px bg-line @3xl:grid-cols-3 @6xl:grid-cols-4 ${cards.loading ? 'opacity-50' : ''}`}>
        {shown.map((name) => {
          const c = byName.get(name)!;
          return (
            <button key={name} onClick={() => openPerson(name)} className="min-w-0 bg-surface p-3 text-left hover:bg-surface-2">
              <div className="flex items-center gap-2">
                <Badge name={name} size={22} />
                <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                <span className="num text-[11px] text-ink-3">{fmtPct(c.n / total, 1)}</span>
              </div>
              <div className="mt-2">
                <Sparkline values={series.get(name) ?? []} width={220} height={26} color={colorOf(name)} />
              </div>
              <div className="num mt-1.5 flex justify-between gap-2 text-[11px] text-ink-3">
                <span><b className="font-semibold text-ink">{fmtInt(c.n)}</b> msgs</span>
                <span>{c.n ? ((c.got / c.n) * 100).toFixed(0) : 0} reactions/100</span>
                <span>peak {String(c.peak).padStart(2, '0')}h</span>
              </div>
              <div className="num mt-0.5 truncate text-[11px] text-ink-3">{fmtDate(c.first_ts)} → {fmtDate(c.last_ts)}</div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

export function Overview({ openPerson }: { openPerson: (name: string) => void }) {
  return (
    <div className="space-y-3 p-4">
      <KpiRow />
      <Timeline />
      <div className="grid grid-cols-1 gap-3 @4xl:grid-cols-2">
        <ShareOfVoice />
        <ShareOverTime />
      </div>
      <EveryoneGrid openPerson={openPerson} />
      <PersonYearBump />
      <PeopleTable />
    </div>
  );
}
