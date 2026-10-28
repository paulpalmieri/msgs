// Activity: when the conversation happens. One heatmap (weekday × hour);
// everything else is a chart for one question: a year's calendar, parts of
// the day over time, each person's hourly shape, weekend habits, and every
// day with its silences.
import { useMemo, useState } from 'react';
import { useConversation } from '../app/ConversationProvider';
import { EChart } from '../charts/EChart';
import { gridHeatmap, quantile } from '../charts/heatmap';
import { baseOption, esc, tipRow, useChartTheme } from '../charts/theme';
import { useQuery } from '../db/useQuery';
import { fmtDate, fmtInt, fmtPct } from '../lib/format';
import { DAY, fmtDuration, hourLabel, tsLit, WEEKDAYS } from '../lib/time';
import { Badge } from '../ui/Badge';
import { Panel, Segmented, Stat } from '../ui/primitives';

const HOURS = Array.from({ length: 24 }, (_, h) => hourLabel(h));
const longDay = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// --- KPIs ------------------------------------------------------------------------

type ActivityKpis = {
  active_days: number; span_days: number; busiest_day: number | null; busiest_n: number; peak_hour: number | null;
  peak_dow: number | null; longest_streak: number; longest_silence_ms: number | null; messages: number;
};

function KpiRow() {
  const k = useQuery<ActivityKpis>(`
    WITH d AS (SELECT DISTINCT ts::DATE AS d FROM sel),
    streaks AS (SELECT count(*) AS len FROM (SELECT d, d - CAST(row_number() OVER (ORDER BY d) AS INTEGER) AS grp FROM d) GROUP BY grp),
    gaps AS (SELECT epoch_ms(lead(ts) OVER (ORDER BY ts)) - epoch_ms(ts) AS gap FROM sel)
    SELECT (SELECT count(*) FROM d) AS active_days,
           (SELECT date_diff('day', min(d), max(d)) + 1 FROM d) AS span_days,
           (SELECT epoch_ms(ts::DATE::TIMESTAMP) FROM sel GROUP BY ts::DATE ORDER BY count(*) DESC LIMIT 1) AS busiest_day,
           (SELECT count(*) FROM sel GROUP BY ts::DATE ORDER BY count(*) DESC LIMIT 1) AS busiest_n,
           (SELECT hour(ts) FROM sel GROUP BY 1 ORDER BY count(*) DESC LIMIT 1) AS peak_hour,
           (SELECT isodow(ts) FROM sel GROUP BY 1 ORDER BY count(*) DESC LIMIT 1) AS peak_dow,
           (SELECT coalesce(max(len), 0) FROM streaks) AS longest_streak,
           (SELECT max(gap) FROM gaps) AS longest_silence_ms,
           (SELECT count(*) FROM sel) AS messages`).data?.[0];
  return (
    <div className="grid grid-cols-3 gap-3 @5xl:grid-cols-6">
      <Stat label="Active days" value={fmtInt(k?.active_days)} sub={k?.span_days ? `${fmtPct(k.active_days / k.span_days, 0)} of ${fmtInt(k.span_days)} days` : undefined} />
      <Stat label="Busiest day" value={k?.busiest_day != null ? fmtDate(k.busiest_day) : '–'} sub={k ? `${fmtInt(k.busiest_n)} messages` : undefined} />
      <Stat label="Peak hour" value={k?.peak_hour != null ? `${hourLabel(k.peak_hour)}–${hourLabel((k.peak_hour + 1) % 24)}` : '–'} sub={k?.peak_dow != null ? `busiest weekday: ${WEEKDAYS[k.peak_dow - 1]}` : undefined} />
      <Stat label="Longest streak" value={k ? `${fmtInt(k.longest_streak)} days` : '–'} sub="consecutive active days" />
      <Stat label="Longest silence" value={fmtDuration(k?.longest_silence_ms)} sub="between two messages" />
      <Stat label="Per active day" value={k?.active_days ? (k.messages / k.active_days).toFixed(1) : '–'} sub="messages on days with any" />
    </div>
  );
}

// --- Calendar --------------------------------------------------------------------

function CalendarPanel() {
  const t = useChartTheme();
  const { inspect } = useConversation();
  const q = useQuery<{ d: string; n: number }>(`SELECT strftime(ts::DATE, '%Y-%m-%d') AS d, count(*) AS n FROM sel GROUP BY 1`);
  const days = q.data ?? [];
  const years = [...new Set(days.map((r) => Number(r.d.slice(0, 4))))].sort((a, b) => b - a);
  const [picked, setPicked] = useState<number | null>(null);
  const year = picked !== null && years.includes(picked) ? picked : years[0];
  const yearDays = days.filter((r) => r.d.startsWith(String(year)));
  const totals = new Map<number, number>();
  for (const r of days) totals.set(Number(r.d.slice(0, 4)), (totals.get(Number(r.d.slice(0, 4))) ?? 0) + r.n);

  const option = useMemo(() => {
    const base = baseOption(t);
    // One colour scale for every year, so switching years compares fairly.
    const max = quantile(days.map((r) => r.n), 0.97);
    return {
      ...base,
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (p: { value: [string, number] }) =>
          `<div style="margin-bottom:4px;opacity:.7">${esc(longDay.format(new Date(`${p.value[0]}T00:00:00Z`)))}</div>` + tipRow(t.series[0], fmtInt(p.value[1]), 'messages'),
      },
      visualMap: {
        min: 0, max, calculable: false, orient: 'horizontal', right: 16, bottom: 0, itemHeight: 120, itemWidth: 10,
        text: [`${fmtInt(max)}+`, '1'], textStyle: { color: t.muted, fontSize: 10 }, inRange: { color: t.seq.slice(1) },
      },
      calendar: {
        top: 24, left: 40, right: 16, bottom: 36,
        range: String(year ?? new Date().getFullYear()),
        cellSize: ['auto', 'auto'],
        splitLine: { show: false },
        itemStyle: { color: t.seq[0], borderColor: t.surface, borderWidth: 3 },
        yearLabel: { show: false },
        monthLabel: { color: t.muted, fontSize: 11, nameMap: 'EN' },
        dayLabel: { firstDay: 1, color: t.muted, fontSize: 10, nameMap: ['S', 'M', 'T', 'W', 'T', 'F', 'S'] },
      },
      series: [{
        type: 'heatmap', coordinateSystem: 'calendar',
        data: yearDays.map((r) => [r.d, r.n]),
        itemStyle: { borderRadius: 3 },
        emphasis: { itemStyle: { borderColor: t.ink, borderWidth: 1 } },
      }],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, year, t]);

  return (
    <Panel
      title="Calendar"
      actions={
        <div className="flex flex-wrap items-center justify-end gap-1">
          {years.map((y) => (
            <button key={y} onClick={() => setPicked(y)} className={`h-6 rounded px-2 text-[11px] ${y === year ? 'bg-accent-soft font-medium text-ink' : 'text-ink-3 hover:text-ink'}`} title={`${fmtInt(totals.get(y))} messages`}>
              {y}
            </button>
          ))}
        </div>
      }
      bodyClassName="p-2"
    >
      <EChart
        option={option}
        height={230}
        dimmed={q.loading}
        on={{
          click: (p: { value: [string, number] }) =>
            inspect({ title: longDay.format(new Date(`${p.value[0]}T00:00:00Z`)), where: `ts::DATE = DATE '${p.value[0]}'` }),
        }}
      />
    </Panel>
  );
}

// --- Rhythms -----------------------------------------------------------------------

function WeekHourHeatmap() {
  const t = useChartTheme();
  const { inspect } = useConversation();
  const [view, setView] = useState<'grid' | 'clock'>('grid');
  const q = useQuery<{ dow: number; h: number; n: number }>(`SELECT isodow(ts) AS dow, hour(ts) AS h, count(*) AS n FROM sel GROUP BY 1, 2`);
  const rows = [...WEEKDAYS].reverse(); // Monday on top
  const option = useMemo(() => {
    if (view === 'grid') {
      return gridHeatmap(t, {
        x: HOURS, y: rows,
        cells: (q.data ?? []).map((r) => [r.h, 7 - r.dow, r.n]),
        title: (x, y) => `${y} · ${x}`,
        value: (v) => `${fmtInt(v)} messages`,
        labelWidth: 40,
      });
    }
    // The same 24 hours as a clock: midnight at the top, weekdays stacked weekend-last.
    const base = baseOption(t);
    const per = (dow: number) => HOURS.map((_, h) => q.data?.find((r) => r.dow === dow && r.h === h)?.n ?? 0);
    const weekday = HOURS.map((_, h) => [1, 2, 3, 4, 5].reduce((a, d) => a + per(d)[h], 0));
    const weekend = HOURS.map((_, h) => [6, 7].reduce((a, d) => a + per(d)[h], 0));
    return {
      ...base,
      legend: { bottom: 0, left: 'center', icon: 'rect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.ink2, fontSize: 11 } },
      tooltip: {
        ...base.tooltip, trigger: 'axis',
        formatter: (ps: { seriesName: string; value: number; color: string; dataIndex: number }[]) =>
          `<div style="margin-bottom:4px;opacity:.7">${HOURS[ps[0].dataIndex]}–${HOURS[(ps[0].dataIndex + 1) % 24]}</div>` + ps.map((p) => tipRow(p.color, fmtInt(p.value), p.seriesName)).join(''),
      },
      polar: { radius: ['14%', '78%'], center: ['50%', '48%'] },
      angleAxis: { type: 'category', data: HOURS, startAngle: 90 + 7.5, axisLine: { lineStyle: { color: t.axis } }, axisTick: { show: false }, axisLabel: { color: t.muted, fontSize: 10, interval: 2 }, splitLine: { show: false } },
      radiusAxis: { axisLabel: { show: false }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: t.grid } } },
      series: [
        { name: 'Weekdays', type: 'bar', coordinateSystem: 'polar', stack: 'h', data: weekday, itemStyle: { color: t.series[0] } },
        { name: 'Weekends', type: 'bar', coordinateSystem: 'polar', stack: 'h', data: weekend, itemStyle: { color: t.seq[t.dark ? 6 : 2] } },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, t, view]);
  return (
    <Panel
      title="Weekday × hour"
      actions={<div className="flex items-center gap-3"><span className="text-[11px] text-ink-3">click to read</span><Segmented value={view} options={[['grid', 'Grid'], ['clock', 'Clock']]} onChange={setView} /></div>}
      bodyClassName="p-2"
    >
      <EChart
        option={option}
        height={view === 'grid' ? 260 : 320}
        dimmed={q.loading}
        on={{
          click: (p: { value: [number, number, number] | number; dataIndex: number; seriesName?: string }) => {
            if (view === 'clock') {
              const h = p.dataIndex;
              const weekend = p.seriesName === 'Weekends';
              return inspect({ title: `${weekend ? 'Weekends' : 'Weekdays'}, ${hourLabel(h)}–${hourLabel((h + 1) % 24)}`, where: `hour(ts) = ${h} AND isodow(ts) ${weekend ? '>= 6' : '<= 5'}` });
            }
            const v = p.value as [number, number, number];
            const dow = 7 - v[1];
            inspect({ title: `${WEEKDAYS[dow - 1]}s, ${hourLabel(v[0])}–${hourLabel((v[0] + 1) % 24)}`, where: `isodow(ts) = ${dow} AND hour(ts) = ${v[0]}` });
          },
        }}
      />
    </Panel>
  );
}

const RIDGE_ROW = 30;
const RIDGE_LIMIT = 20;

/**
 * One small hourly curve per person, stacked like a ridgeline, each over the
 * group's curve (grey). All rows share one scale, so a tall narrow peak means
 * a person concentrated in a few hours.
 */
function HourRidgeline() {
  const t = useChartTheme();
  const { seriesNames, seriesWhere, colorOf, inspect } = useConversation();
  const [all, setAll] = useState(false);
  const q = useQuery<{ s: string; h: number; n: number }>(`SELECT sender AS s, hour(ts) AS h, count(*) AS n FROM sel GROUP BY 1, 2`);

  const { option, people, height } = useMemo(() => {
    const base = baseOption(t);
    const by = new Map<string, number[]>();
    const group = new Array(24).fill(0);
    for (const r of q.data ?? []) {
      let arr = by.get(r.s);
      if (!arr) by.set(r.s, (arr = new Array(24).fill(0)));
      arr[r.h] = r.n;
      group[r.h] += r.n;
    }
    const share = (arr: number[]) => { const tot = arr.reduce((a, b) => a + b, 0) || 1; return arr.map((n) => (n / tot) * 100); };
    const groupShare = share(group);
    const ranked = seriesNames.filter((n) => by.has(n));
    const people = all ? ranked : ranked.slice(0, RIDGE_LIMIT);
    const curves = new Map(people.map((p) => [p, share(by.get(p)!)]));
    const max = Math.max(1, ...groupShare, ...[...curves.values()].flat());
    const top = 8, left = 150, rowH = RIDGE_ROW;
    return {
      people,
      height: top + people.length * rowH + 44,
      option: {
        ...base,
        animation: false,
        tooltip: {
          ...base.tooltip, trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: t.axis } },
          formatter: (ps: { seriesName: string; value: number; color: string; dataIndex: number }[]) => {
            const me = ps.find((p) => p.seriesName !== 'group');
            if (!me) return '';
            const h = ps[0].dataIndex;
            return `<div style="margin-bottom:4px;opacity:.7">${esc(me.seriesName)} · ${HOURS[h]}</div>` +
              tipRow(me.color, `${me.value.toFixed(1)}%`, 'of their messages') + tipRow(t.muted, `${groupShare[h].toFixed(1)}%`, 'of the group’s');
          },
        },
        axisPointer: { link: [{ xAxisIndex: 'all' }] },
        // Each row's plot is taller than its slot, so curves overlap the row above, ridgeline-style.
        grid: people.map((_, i) => ({ left, right: 16, top: top + i * rowH - rowH * 0.6, height: rowH * 1.6 })),
        xAxis: people.map((_, i) => ({
          type: 'category', gridIndex: i, data: HOURS, boundaryGap: false,
          axisLine: { show: i === people.length - 1, lineStyle: { color: t.axis } }, axisTick: { show: false },
          axisLabel: { show: i === people.length - 1, color: t.muted, fontSize: 10, interval: 2 }, splitLine: { show: false },
        })),
        yAxis: people.map((_, i) => ({ type: 'value', gridIndex: i, min: 0, max, show: false })),
        graphic: people.map((p, i) => ({
          type: 'text', left: 8, top: top + i * rowH + rowH * 0.2,
          style: { text: p.length > 20 ? `${p.slice(0, 19)}…` : p, fill: t.ink2, fontSize: 11, fontFamily: 'system-ui, sans-serif' },
        })),
        series: people.flatMap((p, i) => [
          { name: 'group', type: 'line', xAxisIndex: i, yAxisIndex: i, smooth: 0.35, symbol: 'none', silent: true, z: 1, lineStyle: { width: 1, color: t.muted, type: 'dashed' }, data: groupShare },
          { name: p, type: 'line', xAxisIndex: i, yAxisIndex: i, smooth: 0.35, symbol: 'none', z: 2 + i, lineStyle: { width: 1.5, color: colorOf(p) }, areaStyle: { color: colorOf(p), opacity: 0.45 }, data: curves.get(p) },
        ]),
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, seriesNames, colorOf, t, all]);

  const total = seriesNames.length;
  return (
    <Panel
      title="When each person talks"
      actions={
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-ink-3">share of each person’s messages by hour · dashed = the group · click to read</span>
          {total > RIDGE_LIMIT && <button onClick={() => setAll((a) => !a)} className="text-[11px] text-accent">{all ? `Top ${RIDGE_LIMIT}` : `All ${total}`}</button>}
        </div>
      }
      bodyClassName="p-2"
    >
      <EChart
        option={option}
        height={height}
        dimmed={q.loading}
        on={{
          click: (p: { seriesName: string; dataIndex: number }) => {
            if (!people.includes(p.seriesName)) return;
            inspect({ title: `${p.seriesName} · ${HOURS[p.dataIndex]}`, where: `hour(ts) = ${p.dataIndex} AND ${seriesWhere(p.seriesName)}` });
          },
        }}
      />
    </Panel>
  );
}

/** Each person's share of messages sent on weekends, against the group and an even spread (2 of 7 days). */
function WeekendShare() {
  const t = useChartTheme();
  const { seriesNames, seriesWhere, colorOf, inspect } = useConversation();
  const q = useQuery<{ s: string; n: number; we: number }>(`SELECT sender AS s, count(*) AS n, count(*) FILTER (isodow(ts) >= 6) AS we FROM sel GROUP BY 1 HAVING count(*) >= 20`);
  const { option, rows } = useMemo(() => {
    const base = baseOption(t);
    const data = q.data ?? [];
    const groupShare = (data.reduce((a, r) => a + r.we, 0) / Math.max(1, data.reduce((a, r) => a + r.n, 0))) * 100;
    const rows = seriesNames.map((n) => data.find((r) => r.s === n)).filter((r): r is NonNullable<typeof r> => !!r).reverse();
    const v = rows.map((r) => (r.we / r.n) * 100);
    return {
      rows,
      option: {
        ...base,
        grid: { ...base.grid, left: 8, right: 30, top: 24, bottom: 24 },
        tooltip: {
          ...base.tooltip, trigger: 'item',
          formatter: (p: { dataIndex: number }) => {
            const r = rows[p.dataIndex];
            return `<div style="font-weight:600;margin-bottom:4px">${esc(r.s)}</div>` + tipRow(colorOf(r.s), `${v[p.dataIndex].toFixed(0)}%`, `of messages on weekends (${fmtInt(r.we)})`) +
              tipRow(t.muted, `${groupShare.toFixed(0)}%`, 'the group');
          },
        },
        xAxis: { type: 'value', min: 0, max: (m: { max: number }) => Math.ceil(Math.max(m.max, 40) / 10) * 10, ...base.axisCommon, axisLabel: { ...base.axisCommon.axisLabel, formatter: '{value}%' } },
        yAxis: {
          type: 'category', data: rows.map((r) => r.s), ...base.axisCommon, axisLine: { show: false },
          axisLabel: { color: t.ink2, fontSize: rows.length > 30 ? 10 : 11, width: 130, overflow: 'truncate' },
        },
        series: [
          // Lollipop stick from the group's share to the person's.
          { type: 'bar', stack: 'l', silent: true, itemStyle: { color: 'transparent' }, data: v.map((x) => Math.min(x, groupShare)), barWidth: 2 },
          { type: 'bar', stack: 'l', silent: true, data: v.map((x, i) => ({ value: Math.abs(x - groupShare), itemStyle: { color: colorOf(rows[i].s), opacity: 0.5 } })), barWidth: 2 },
          {
            type: 'scatter', symbolSize: 11, z: 3,
            data: v.map((x, i) => ({ value: [x, i], itemStyle: { color: colorOf(rows[i].s), borderColor: t.surface, borderWidth: 2 } })),
            markLine: {
              silent: true, symbol: 'none',
              data: [
                { xAxis: groupShare, lineStyle: { color: t.ink2, type: 'dashed' }, label: { formatter: `group ${groupShare.toFixed(0)}%`, color: t.ink2, fontSize: 10, position: 'end' } },
                { xAxis: (2 / 7) * 100, lineStyle: { color: t.muted, type: 'dotted' }, label: { formatter: 'even 29%', color: t.muted, fontSize: 10, position: 'start' } },
              ],
            },
          },
        ],
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, seriesNames, colorOf, t]);
  return (
    <Panel title="Weekend people" actions={<span className="text-[11px] text-ink-3">share of each person’s messages on Sat–Sun · click to read</span>} bodyClassName="p-2">
      <EChart
        option={option}
        height={Math.max(200, rows.length * (rows.length > 30 ? 16 : 24) + 50)}
        dimmed={q.loading}
        on={{ click: (p: { dataIndex: number; seriesType: string }) => p.seriesType === 'scatter' && inspect({ title: `${rows[p.dataIndex].s} on weekends`, where: `isodow(ts) >= 6 AND ${seriesWhere(rows[p.dataIndex].s)}` }) }}
      />
    </Panel>
  );
}

const PARTS = [
  { name: 'Morning', hours: '5–12h', sql: 'hour(ts) >= 5 AND hour(ts) < 12' },
  { name: 'Afternoon', hours: '12–18h', sql: 'hour(ts) >= 12 AND hour(ts) < 18' },
  { name: 'Evening', hours: '18–23h', sql: 'hour(ts) >= 18 AND hour(ts) < 23' },
  { name: 'Night', hours: '23–5h', sql: 'hour(ts) >= 23 OR hour(ts) < 5' },
];

/** How the conversation's day is split, period by period (each period sums to 100%). */
function DayParts() {
  const t = useChartTheme();
  const { inspect } = useConversation();
  const q = useQuery<{ b: number; m: number; a: number; e: number; n: number }>(`
    WITH span_days AS (SELECT date_diff('day', min(ts), max(ts)) AS d FROM sel)
    SELECT epoch_ms(date_trunc(CASE WHEN (SELECT d FROM span_days) > 3 * 365 THEN 'year' WHEN (SELECT d FROM span_days) > 180 THEN 'quarter' ELSE 'month' END, ts)) AS b,
           ${PARTS.map((p, i) => `count(*) FILTER (${p.sql}) AS ${'maen'[i]}`).join(', ')}
    FROM sel GROUP BY 1 ORDER BY 1`);
  const data = q.data ?? [];
  const grain = data.length > 1 && data[1].b - data[0].b > 300 * DAY ? 'year' : data.length > 1 && data[1].b - data[0].b > 80 * DAY ? 'quarter' : 'month';
  const label = (ms: number) => {
    const d = new Date(ms);
    return grain === 'year' ? String(d.getUTCFullYear()) : grain === 'quarter' ? `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}` : `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };
  const option = useMemo(() => {
    const base = baseOption(t);
    // Darker = later in the day, in both themes.
    const colors = t.dark ? [t.seq[7], t.seq[6], t.seq[4], t.seq[2]] : [t.seq[2], t.seq[3], t.seq[5], t.seq[7]];
    const keys = ['m', 'a', 'e', 'n'] as const;
    return {
      ...base,
      grid: { ...base.grid, top: 36 },
      legend: { top: 0, left: 0, icon: 'rect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.ink2, fontSize: 11 }, data: PARTS.map((p) => p.name) },
      tooltip: {
        ...base.tooltip, trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: t.axis } },
        formatter: (ps: { seriesName: string; value: number; color: string; dataIndex: number }[]) =>
          `<div style="margin-bottom:4px;opacity:.7">${esc(label(data[ps[0].dataIndex].b))} · ${fmtInt(data[ps[0].dataIndex].m + data[ps[0].dataIndex].a + data[ps[0].dataIndex].e + data[ps[0].dataIndex].n)} messages</div>` +
          [...ps].reverse().map((p) => tipRow(p.color, `${p.value.toFixed(0)}%`, `${p.seriesName} (${PARTS.find((x) => x.name === p.seriesName)!.hours})`)).join(''),
      },
      xAxis: { type: 'category', data: data.map((r) => label(r.b)), boundaryGap: false, ...base.axisCommon, splitLine: { show: false } },
      yAxis: { type: 'value', max: 100, ...base.axisCommon, axisLine: { show: false }, axisLabel: { ...base.axisCommon.axisLabel, formatter: '{value}%' } },
      series: PARTS.map((p, i) => ({
        name: p.name, type: 'line', stack: 'parts', symbol: 'none', smooth: 0.2,
        lineStyle: { width: 0 }, areaStyle: { color: colors[i], opacity: 0.95 }, itemStyle: { color: colors[i] },
        data: data.map((r) => { const tot = r.m + r.a + r.e + r.n || 1; return (r[keys[i]] / tot) * 100; }),
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, t]);
  return (
    <Panel title={`Parts of the day, by ${grain}`} actions={<span className="text-[11px] text-ink-3">each period sums to 100% · click to read</span>} bodyClassName="p-2">
      <EChart
        option={option}
        height={260}
        dimmed={q.loading}
        on={{
          click: (p: { seriesName: string; dataIndex: number }) => {
            const part = PARTS.find((x) => x.name === p.seriesName)!;
            const b = data[p.dataIndex].b;
            const next = data[p.dataIndex + 1]?.b ?? b + (grain === 'year' ? 366 : grain === 'quarter' ? 92 : 31) * DAY;
            inspect({ title: `${part.name}s · ${label(b)}`, where: `(${part.sql}) AND ts >= ${tsLit(b)} AND ts < ${tsLit(next)}` });
          },
        }}
      />
    </Panel>
  );
}

function Person({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge name={name} size={16} />
      {name}
    </span>
  );
}

// --- Streaks & silences ------------------------------------------------------------------

function StreaksAndSilences() {
  const { inspect, filters, setFilters } = useConversation();
  const streaks = useQuery<{ start_ms: number; end_ms: number; days: number; n: number }>(`
    WITH d AS (SELECT ts::DATE AS d, count(*) AS n FROM sel GROUP BY 1),
    g AS (SELECT d, n, d - CAST(row_number() OVER (ORDER BY d) AS INTEGER) AS grp FROM d)
    SELECT epoch_ms(min(d)::TIMESTAMP) AS start_ms, epoch_ms(max(d)::TIMESTAMP) AS end_ms, count(*) AS days, sum(n) AS n
    FROM g GROUP BY grp ORDER BY days DESC, n DESC LIMIT 10`);
  const silences = useQuery<{ before_ms: number; after_ms: number; gap: number; last_sender: string; next_sender: string }>(`
    SELECT * FROM (
      SELECT epoch_ms(ts) AS before_ms, epoch_ms(lead(ts) OVER w) AS after_ms,
             epoch_ms(lead(ts) OVER w) - epoch_ms(ts) AS gap, sender AS last_sender, lead(sender) OVER w AS next_sender
      FROM sel WINDOW w AS (ORDER BY ts, message_id)
    ) WHERE gap IS NOT NULL ORDER BY gap DESC LIMIT 10`);

  const th = 'border-b border-line px-3 py-1.5 font-medium';

  return (
    <>
    <ActiveStrip silences={silences.data ?? []} />
    <details className="group rounded-lg border border-line bg-surface">
      <summary className="cursor-pointer select-none px-3 py-2 text-[12px] font-medium text-ink-2 hover:text-ink">Streak and silence tables</summary>
    <div className="grid grid-cols-1 gap-3 p-3 pt-0 @4xl:grid-cols-2">
      <Panel title="Longest streaks" actions={<span className="text-[11px] text-ink-3">consecutive days with messages · click to filter to it</span>}>
        <table className={`w-full border-collapse text-[12px] ${streaks.loading ? 'opacity-50' : ''}`}>
          <thead>
            <tr className="text-ink-3">
              <th className={`${th} text-left`}>From</th>
              <th className={`${th} text-left`}>To</th>
              <th className={`${th} text-right`}>Days</th>
              <th className={`${th} text-right`}>Messages</th>
            </tr>
          </thead>
          <tbody>
            {streaks.data?.map((r) => (
              <tr key={r.start_ms} className="cursor-pointer hover:bg-surface-2"
                onClick={() => setFilters({ ...filters, from: new Date(r.start_ms).toISOString().slice(0, 10), to: new Date(r.end_ms).toISOString().slice(0, 10) })}>
                <td className="num border-b border-line/60 px-3 py-1">{fmtDate(r.start_ms)}</td>
                <td className="num border-b border-line/60 px-3">{fmtDate(r.end_ms)}</td>
                <td className="num border-b border-line/60 px-3 text-right">{fmtInt(r.days)}</td>
                <td className="num border-b border-line/60 px-3 text-right">{fmtInt(r.n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="Longest silences" actions={<span className="text-[11px] text-ink-3">click to read the messages around it</span>}>
        <table className={`w-full border-collapse text-[12px] ${silences.loading ? 'opacity-50' : ''}`}>
          <thead>
            <tr className="text-ink-3">
              <th className={`${th} text-right`}>Silence</th>
              <th className={`${th} text-left`}>From</th>
              <th className={`${th} text-left`}>Broken by</th>
              <th className={`${th} text-left`}>On</th>
            </tr>
          </thead>
          <tbody>
            {silences.data?.map((r) => (
              <tr key={r.before_ms} className="cursor-pointer hover:bg-surface-2"
                onClick={() => inspect({
                  title: `Around a ${fmtDuration(r.gap)} silence`,
                  where: `(ts BETWEEN ${tsLit(r.before_ms - DAY)} AND ${tsLit(r.before_ms)}) OR (ts BETWEEN ${tsLit(r.after_ms)} AND ${tsLit(r.after_ms + DAY)})`,
                })}>
                <td className="num border-b border-line/60 px-3 py-1 text-right font-medium">{fmtDuration(r.gap)}</td>
                <td className="num border-b border-line/60 px-3">{fmtDate(r.before_ms)}</td>
                <td className="border-b border-line/60 px-3"><Person name={r.next_sender} /></td>
                <td className="num border-b border-line/60 px-3">{fmtDate(r.after_ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
    </details>
    </>
  );
}

/**
 * Every day of the selection as a thin bar (a barcode of activity), with the
 * longest silences shaded and labelled where they happened.
 */
function ActiveStrip({ silences }: { silences: { before_ms: number; after_ms: number; gap: number }[] }) {
  const t = useChartTheme();
  const { inspect } = useConversation();
  const q = useQuery<{ d: number; n: number }>(`
    WITH r AS (SELECT min(ts)::DATE AS a, max(ts)::DATE AS b FROM sel),
    days AS (SELECT unnest(range(r.a::TIMESTAMP, r.b::TIMESTAMP + INTERVAL 1 DAY, INTERVAL 1 DAY)) AS d FROM r),
    c AS (SELECT ts::DATE::TIMESTAMP AS d, count(*) AS n FROM sel GROUP BY 1)
    SELECT epoch_ms(days.d) AS d, coalesce(c.n, 0) AS n FROM days LEFT JOIN c USING (d) ORDER BY 1`);
  const data = q.data ?? [];
  const option = useMemo(() => {
    const base = baseOption(t);
    const cap = quantile(data.map((r) => r.n).filter(Boolean), 0.95);
    const labels = data.map((r) => fmtDate(r.d));
    const idx = (ms: number) => Math.max(0, Math.min(data.length - 1, Math.round((ms - (data[0]?.d ?? 0)) / DAY)));
    const gaps = silences.filter((s) => s.gap >= 2 * DAY).slice(0, 6);
    return {
      ...base,
      grid: { left: 8, right: 8, top: 26, bottom: 22, containLabel: false },
      tooltip: {
        ...base.tooltip, trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: t.axis } },
        formatter: (ps: { dataIndex: number }[]) => `${esc(longDay.format(new Date(data[ps[0].dataIndex].d)))}<br/>${tipRow(t.series[0], fmtInt(data[ps[0].dataIndex].n), 'messages')}`,
      },
      xAxis: { type: 'category', data: labels, ...base.axisCommon, axisLabel: { ...base.axisCommon.axisLabel, interval: Math.max(0, Math.floor(data.length / 8)) }, splitLine: { show: false } },
      yAxis: { type: 'value', max: cap, show: false },
      series: [{
        type: 'bar', large: data.length > 1500, barCategoryGap: 0,
        itemStyle: { color: t.series[0] },
        data: data.map((r) => Math.min(r.n, cap)),
        markArea: {
          silent: true,
          itemStyle: { color: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
          label: { color: t.ink2, fontSize: 10, position: 'top' },
          data: gaps.map((g) => [{ xAxis: idx(g.before_ms), name: fmtDuration(g.gap) }, { xAxis: idx(g.after_ms) }]),
        },
      }],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, silences, t]);
  return (
    <Panel title="Every day, and the silences" actions={<span className="text-[11px] text-ink-3">one bar per day · shaded = the longest silences · click a day to read</span>} bodyClassName="p-2">
      <EChart
        option={option}
        height={120}
        dimmed={q.loading}
        on={{ click: (p: { dataIndex: number }) => { const d = data[p.dataIndex]; if (d?.n) inspect({ title: longDay.format(new Date(d.d)), where: `ts::DATE = DATE '${new Date(d.d).toISOString().slice(0, 10)}'` }); } }}
      />
    </Panel>
  );
}

export function Activity() {
  return (
    <div className="space-y-3 p-4">
      <KpiRow />
      <CalendarPanel />
      <div className="grid grid-cols-1 gap-3 @4xl:grid-cols-2">
        <WeekHourHeatmap />
        <DayParts />
      </div>
      <div className="grid grid-cols-1 gap-3 @5xl:grid-cols-[3fr_2fr]">
        <HourRidgeline />
        <WeekendShare />
      </div>
      <StreaksAndSilences />
    </div>
  );
}
