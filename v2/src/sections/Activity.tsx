// Activity: when the conversation happens. Calendar, daily and weekly
// rhythms per person, sessions (bursts of back-and-forth), streaks and silences.
import { useMemo, useState } from 'react';
import { useConversation } from '../app/ConversationProvider';
import { EChart } from '../charts/EChart';
import { gridHeatmap, personHeatmap, quantile } from '../charts/heatmap';
import { baseOption, esc, tipRow, useChartTheme } from '../charts/theme';
import { useQuery } from '../db/useQuery';
import { fmtDate, fmtInt, fmtPct } from '../lib/format';
import { DAY, fmtDuration, hourLabel, MINUTE, tsLit, WEEKDAYS } from '../lib/time';
import { Badge } from '../ui/Badge';
import { Panel, Segmented, Stat } from '../ui/primitives';

const HOURS = Array.from({ length: 24 }, (_, h) => hourLabel(h));
const longDay = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// --- Sessions -------------------------------------------------------------------
// A session is a run of messages with no pause longer than the chosen gap.

const GAPS = [['15', '15 min'], ['30', '30 min'], ['60', '1 h'], ['120', '2 h'], ['360', '6 h']] as const;
type Gap = (typeof GAPS)[number][0];

function sessionsCte(gapMin: Gap, seriesSql: string) {
  return `
    WITH m AS (
      SELECT ts, sender, ${seriesSql} AS s, message_id,
             CASE WHEN lag(ts) OVER w IS NULL OR ts - lag(ts) OVER w > INTERVAL ${gapMin} MINUTE THEN 1 ELSE 0 END AS starts
      FROM sel WINDOW w AS (ORDER BY ts, message_id)
    ),
    m2 AS (SELECT *, sum(starts) OVER (ORDER BY ts, message_id ROWS UNBOUNDED PRECEDING) AS sid FROM m),
    sessions AS (
      SELECT sid, epoch_ms(min(ts)) AS start_ms, epoch_ms(max(ts)) AS end_ms, count(*) AS n,
             count(DISTINCT sender) AS people, arg_min(s, (ts, message_id)) AS starter, arg_max(s, (ts, message_id)) AS ender
      FROM m2 GROUP BY sid
    )`;
}

const SESSION_BINS: [string, number][] = [
  ['< 1 min', 1], ['1–5 min', 5], ['5–15 min', 15], ['15–30 min', 30], ['30–60 min', 60], ['1–2 h', 120], ['2–4 h', 240], ['4 h +', Infinity],
];

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
  const CELL = 13;
  const YEAR_H = CELL * 7 + 30;

  const option = useMemo(() => {
    const base = baseOption(t);
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
        min: 0, max, calculable: false, orient: 'horizontal', right: 16, top: 0, itemHeight: 120, itemWidth: 10,
        text: [`${fmtInt(max)}+`, '1'], textStyle: { color: t.muted, fontSize: 10 }, inRange: { color: t.seq.slice(1) },
      },
      calendar: years.map((y, i) => ({
        top: 34 + i * YEAR_H,
        left: 56,
        right: 16,
        range: String(y),
        cellSize: ['auto', CELL],
        splitLine: { show: false },
        itemStyle: { color: t.seq[0], borderColor: t.surface, borderWidth: 2 },
        yearLabel: { show: true, position: 'left', margin: 36, color: t.ink, fontSize: 12, fontWeight: 600 },
        monthLabel: { color: t.muted, fontSize: 10, nameMap: 'EN' },
        dayLabel: { firstDay: 1, color: t.muted, fontSize: 9, nameMap: ['S', 'M', 'T', 'W', 'T', 'F', 'S'] },
      })),
      series: years.map((y, i) => ({
        type: 'heatmap',
        coordinateSystem: 'calendar',
        calendarIndex: i,
        data: days.filter((r) => r.d.startsWith(String(y))).map((r) => [r.d, r.n]),
        itemStyle: { borderRadius: 2 },
        emphasis: { itemStyle: { borderColor: t.ink, borderWidth: 1 } },
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, t]);

  return (
    <Panel title="Calendar" actions={<span className="text-[11px] text-ink-3">{years.length} years · click a day to read it</span>} bodyClassName="p-2">
      <EChart
        option={option}
        height={Math.max(150, 34 + years.length * YEAR_H)}
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
  const q = useQuery<{ dow: number; h: number; n: number }>(`SELECT isodow(ts) AS dow, hour(ts) AS h, count(*) AS n FROM sel GROUP BY 1, 2`);
  const rows = [...WEEKDAYS].reverse(); // Monday on top
  const option = useMemo(
    () => gridHeatmap(t, {
      x: HOURS,
      y: rows,
      cells: (q.data ?? []).map((r) => [r.h, 7 - r.dow, r.n]),
      title: (x, y) => `${y} · ${x}`,
      value: (v) => `${fmtInt(v)} messages`,
      labelWidth: 40,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q.data, t],
  );
  return (
    <Panel title="Weekday × hour" actions={<span className="text-[11px] text-ink-3">click a cell to read</span>} bodyClassName="p-2">
      <EChart
        option={option}
        height={260}
        dimmed={q.loading}
        on={{
          click: (p: { value: [number, number, number] }) => {
            const dow = 7 - p.value[1];
            const h = p.value[0];
            inspect({ title: `${WEEKDAYS[dow - 1]}s, ${hourLabel(h)}–${hourLabel((h + 1) % 24)}`, where: `isodow(ts) = ${dow} AND hour(ts) = ${h}` });
          },
        }}
      />
    </Panel>
  );
}

/** Each person's messages over hours / weekdays, as a share of their own total: one row per person. */
function RhythmByPerson({ unit }: { unit: 'hour' | 'dow' }) {
  const t = useChartTheme();
  const { seriesNames, seriesWhere, colorOf, inspect } = useConversation();
  const expr = unit === 'hour' ? 'hour(ts)' : 'isodow(ts) - 1';
  const q = useQuery<{ s: string; k: number; n: number }>(`SELECT sender AS s, ${expr} AS k, count(*) AS n FROM sel GROUP BY 1, 2`);
  const labels = unit === 'hour' ? HOURS : WEEKDAYS;

  const { option, rows, height } = useMemo(() => {
    const values = new Map<string, number[]>();
    for (const r of q.data ?? []) {
      let arr = values.get(r.s);
      if (!arr) values.set(r.s, (arr = new Array(labels.length).fill(0)));
      arr[r.k] = r.n;
    }
    return personHeatmap(t, {
      people: seriesNames, colorOf, x: labels, values, rowShare: true,
      title: (x, p) => `${p} · ${x}`,
      value: (v) => `${v.toFixed(1)}% of their messages`,
      legend: ['more', 'less'],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, seriesNames, colorOf, t, unit]);

  return (
    <Panel
      title={unit === 'hour' ? 'Hour of day, by person' : 'Day of week, by person'}
      actions={<span className="text-[11px] text-ink-3">each row is one person’s own rhythm · click to read</span>}
      bodyClassName="p-2"
    >
      <EChart
        option={option}
        height={height}
        dimmed={q.loading}
        on={{
          click: (p: { value: [number, number, number] }) => {
            const who = rows[p.value[1]];
            const cond = unit === 'hour' ? `hour(ts) = ${p.value[0]}` : `isodow(ts) = ${p.value[0] + 1}`;
            inspect({ title: `${who} · ${labels[p.value[0]]}`, where: `${cond} AND ${seriesWhere(who)}` });
          },
        }}
      />
    </Panel>
  );
}

/** How the daily rhythm shifted over the years (each year sums to 100%). */
function HourByYear() {
  const t = useChartTheme();
  const { inspect } = useConversation();
  const q = useQuery<{ y: number; h: number; n: number }>(`SELECT year(ts) AS y, hour(ts) AS h, count(*) AS n FROM sel GROUP BY 1, 2`);
  const data = q.data ?? [];
  const years = [...new Set(data.map((r) => r.y))].sort((a, b) => b - a);
  const option = useMemo(() => {
    const totals = new Map<number, number>();
    for (const r of data) totals.set(r.y, (totals.get(r.y) ?? 0) + r.n);
    const cells = data.map((r) => [r.h, years.indexOf(r.y), (r.n / totals.get(r.y)!) * 100] as [number, number, number]);
    return gridHeatmap(t, {
      x: HOURS,
      y: years.map(String),
      cells,
      max: quantile(cells.map((c) => c[2]), 0.97),
      title: (x, y) => `${y} · ${x}`,
      value: (v) => `${v.toFixed(1)}% of the year`,
      legend: ['more', 'less'],
      labelWidth: 40,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, t]);
  return (
    <Panel title="Hour of day, by year" actions={<span className="text-[11px] text-ink-3">each row sums to 100%</span>} bodyClassName="p-2">
      <EChart
        option={option}
        height={Math.max(180, years.length * 22 + 64)}
        dimmed={q.loading}
        on={{
          click: (p: { value: [number, number, number] }) => {
            const y = years[p.value[1]];
            const h = p.value[0];
            inspect({ title: `${y} · ${hourLabel(h)}–${hourLabel((h + 1) % 24)}`, where: `year(ts) = ${y} AND hour(ts) = ${h}` });
          },
        }}
      />
    </Panel>
  );
}

// --- Sessions ------------------------------------------------------------------------

type SessionStats = { sessions: number; median_ms: number; median_n: number; avg_people: number; per_day: number };
type SessionRow = { sid: number; start_ms: number; end_ms: number; n: number; people: number; starter: string; ender: string };

function SessionsBlock() {
  const t = useChartTheme();
  const { seriesSql, seriesNames, colorOf, inspect, conv } = useConversation();
  const [gap, setGap] = useState<Gap>('30');
  const cte = sessionsCte(gap, seriesSql);

  const stats = useQuery<SessionStats>(`${cte}
    SELECT count(*) AS sessions, median(end_ms - start_ms) AS median_ms, median(n) AS median_n, avg(people) AS avg_people,
           count(*) / count(DISTINCT CAST(epoch_ms(start_ms::BIGINT) AS DATE)) AS per_day
    FROM sessions`).data?.[0];
  const bins = useQuery<{ b: number; c: number }>(`${cte}
    SELECT CASE ${SESSION_BINS.map(([, max], i) => (max === Infinity ? '' : `WHEN end_ms - start_ms < ${max * MINUTE} THEN ${i}`)).join(' ')} ELSE ${SESSION_BINS.length - 1} END AS b,
           count(*) AS c FROM sessions GROUP BY 1`);
  const starters = useQuery<{ s: string; started: number; ended: number }>(`${cte}
    SELECT s, sum(st) AS started, sum(en) AS ended FROM (
      SELECT starter AS s, 1 AS st, 0 AS en FROM sessions UNION ALL SELECT ender, 0, 1 FROM sessions
    ) GROUP BY s`);
  const longest = useQuery<SessionRow>(`${cte} SELECT * FROM sessions ORDER BY n DESC LIMIT 12`);

  const histOption = useMemo(() => {
    const base = baseOption(t);
    const counts = SESSION_BINS.map((_, i) => bins.data?.find((r) => r.b === i)?.c ?? 0);
    const total = counts.reduce((a, b) => a + b, 0);
    return {
      ...base,
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (p: { dataIndex: number; value: number }) =>
          `<div style="margin-bottom:4px;opacity:.7">${esc(SESSION_BINS[p.dataIndex][0])}</div>` + tipRow(t.series[0], fmtInt(p.value), `sessions · ${fmtPct(p.value / total, 0)}`),
      },
      xAxis: { type: 'category', data: SESSION_BINS.map((b) => b[0]), ...base.axisCommon, axisLabel: { ...base.axisCommon.axisLabel, interval: 0 }, splitLine: { show: false } },
      yAxis: { type: 'value', ...base.axisCommon, axisLine: { show: false } },
      series: [{ type: 'bar', barMaxWidth: 36, itemStyle: { color: t.series[0], borderRadius: [3, 3, 0, 0] }, data: counts }],
    };
  }, [bins.data, t]);

  const startOption = useMemo(() => {
    const base = baseOption(t);
    const rows = seriesNames.map((s) => starters.data?.find((r) => r.s === s)).filter((r): r is NonNullable<typeof r> => !!r);
    const total = rows.reduce((n, r) => n + r.started, 0);
    const ordered = [...rows].reverse();
    return {
      ...base,
      grid: { ...base.grid, right: 64 },
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (p: { dataIndex: number }) => {
          const r = ordered[p.dataIndex];
          return `<div style="margin-bottom:4px;font-weight:600">${esc(r.s)}</div>` +
            tipRow(colorOf(r.s), fmtInt(r.started), `sessions started · ${fmtPct(r.started / total, 0)}`) +
            tipRow(t.ink2, fmtInt(r.ended), 'sessions ended (had the last word)');
        },
      },
      xAxis: { type: 'value', ...base.axisCommon, axisLabel: { show: false }, splitLine: { show: false } },
      yAxis: { type: 'category', data: ordered.map((r) => r.s), ...base.axisCommon, axisLine: { show: false }, axisLabel: { color: t.ink2, fontSize: 11, width: 120, overflow: 'truncate' } },
      series: [{
        type: 'bar',
        barMaxWidth: 16,
        data: ordered.map((r) => ({ value: r.started, itemStyle: { color: colorOf(r.s), borderRadius: [0, 3, 3, 0] } })),
        label: { show: true, position: 'right', color: t.ink2, fontSize: 11, formatter: (p: { value: number }) => fmtPct(p.value / total, 0) },
      }],
    };
  }, [starters.data, seriesNames, colorOf, t]);

  const tf = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  const startRows = seriesNames.filter((s) => starters.data?.some((r) => r.s === s)).length;

  return (
    <>
      <div className="flex items-center gap-3 pt-2">
        <h2 className="text-[13px] font-semibold">Sessions</h2>
        <span className="text-ink-3">A session is a run of messages with no pause longer than</span>
        <Segmented value={gap} options={GAPS.map(([v, l]) => [v, l] as [Gap, string])} onChange={setGap} />
      </div>
      <div className="grid grid-cols-2 gap-3 @5xl:grid-cols-4">
        <Stat label="Sessions" value={fmtInt(stats?.sessions)} sub={stats ? `${stats.per_day.toFixed(1)} per active day` : undefined} />
        <Stat label="Typical length" value={fmtDuration(stats?.median_ms)} sub="median session" />
        <Stat label="Typical size" value={stats ? `${fmtInt(Math.round(stats.median_n))} messages` : '–'} sub="median session" />
        <Stat label="People per session" value={stats ? stats.avg_people.toFixed(1) : '–'} sub={conv.isGroup ? `of ${conv.participantCount} members` : 'on average'} />
      </div>
      <div className="grid grid-cols-1 gap-3 @4xl:grid-cols-2">
        <Panel title="Session length" bodyClassName="p-2">
          <EChart option={histOption} height={240} dimmed={bins.loading} />
        </Panel>
        <Panel title="Who starts sessions" actions={<span className="text-[11px] text-ink-3">hover for who ends them</span>} bodyClassName="p-2">
          <EChart option={startOption} height={Math.max(200, startRows * 24 + 24)} dimmed={starters.loading} />
        </Panel>
      </div>
      <Panel title="Biggest sessions" actions={<span className="text-[11px] text-ink-3">click to read</span>}>
        <table className={`w-full border-collapse text-[12px] ${longest.loading ? 'opacity-50' : ''}`}>
          <thead>
            <tr className="text-ink-3">
              <th className="border-b border-line px-3 py-1.5 text-left font-medium">Started</th>
              <th className="border-b border-line px-3 py-1.5 text-right font-medium">Length</th>
              <th className="border-b border-line px-3 py-1.5 text-right font-medium">Messages</th>
              <th className="border-b border-line px-3 py-1.5 text-right font-medium">People</th>
              <th className="border-b border-line px-3 py-1.5 text-left font-medium">Started by</th>
              <th className="border-b border-line px-3 py-1.5 text-left font-medium">Last word</th>
            </tr>
          </thead>
          <tbody>
            {longest.data?.map((r) => (
              <tr key={r.sid} className="cursor-pointer hover:bg-surface-2"
                onClick={() => inspect({ title: `Session · ${tf.format(new Date(r.start_ms))}`, where: `ts >= ${tsLit(r.start_ms)} AND ts <= ${tsLit(r.end_ms)}` })}>
                <td className="num border-b border-line/60 px-3 py-1">{tf.format(new Date(r.start_ms))}</td>
                <td className="num border-b border-line/60 px-3 text-right">{fmtDuration(r.end_ms - r.start_ms)}</td>
                <td className="num border-b border-line/60 px-3 text-right">{fmtInt(r.n)}</td>
                <td className="num border-b border-line/60 px-3 text-right">{r.people}</td>
                <td className="border-b border-line/60 px-3"><Person name={r.starter} /></td>
                <td className="border-b border-line/60 px-3"><Person name={r.ender} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
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
    <div className="grid grid-cols-1 gap-3 @4xl:grid-cols-2">
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
  );
}

export function Activity() {
  return (
    <div className="space-y-3 p-4">
      <KpiRow />
      <CalendarPanel />
      <div className="grid grid-cols-1 gap-3 @4xl:grid-cols-2">
        <WeekHourHeatmap />
        <RhythmByPerson unit="hour" />
        <RhythmByPerson unit="dow" />
        <HourByYear />
      </div>
      <StreaksAndSilences />
      <SessionsBlock />
    </div>
  );
}
