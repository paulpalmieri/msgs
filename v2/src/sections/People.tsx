// People: one profile per person. Volume, rhythm, and their relation to
// each other member. Profiles read `span` (dates + content types) so a
// person stays comparable to everyone else whatever the people filter says.
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useConversation } from '../app/ConversationProvider';
import { REPLY_WINDOWS, repliesCte, replyPairWhere, TURNS_CTE } from '../app/relations';
import { EChart } from '../charts/EChart';
import { baseOption, esc, legend, tipRow, useChartTheme } from '../charts/theme';
import { lit } from '../db/duckdb';
import { useQuery } from '../db/useQuery';
import { fmtCompact, fmtDate, fmtInt, fmtPct } from '../lib/format';
import { fmtDuration, hourLabel, MONTHS, tsLit } from '../lib/time';
import { Panel, Segmented, Stat } from '../ui/primitives';
import { MessagePreview } from '../media/MessagePreview';
import { Badge } from '../ui/Badge';

const MEDIA = "('photo','video','gif','sticker','audio','file')";

function ReplyWindowControl() {
  const { replyWindow, setReplyWindow } = useConversation();
  return (
    <div className="flex items-center gap-3">
      <span className="text-ink-3">A message is a reply when it follows someone else’s within</span>
      <Segmented value={String(replyWindow)} options={REPLY_WINDOWS as [string, string][]} onChange={(v) => setReplyWindow(Number(v))} />
    </div>
  );
}

// --- List ---------------------------------------------------------------------------

function PeopleList({ selected, onSelect }: { selected: string; onSelect: (n: string) => void }) {
  const { colorOf } = useConversation();
  const [q, setQ] = useState('');
  const rows = useQuery<{ sender: string; n: number }>(`SELECT sender, count(*) AS n FROM span GROUP BY 1 ORDER BY n DESC`).data ?? [];
  const total = rows.reduce((a, r) => a + r.n, 0);
  const max = rows[0]?.n ?? 1;
  const shown = rows.filter((r) => r.sender.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
      {rows.length > 8 && (
        <label className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
          <Search size={13} className="text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a person…" className="w-full bg-transparent outline-none" />
        </label>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {shown.map((r) => (
          <button
            key={r.sender}
            onClick={() => onSelect(r.sender)}
            className={`relative flex h-9 w-full flex-col justify-center px-3 text-left ${r.sender === selected ? 'bg-accent-soft' : 'hover:bg-surface-2'}`}
          >
            <span className="flex w-full items-center gap-2">
              <Badge name={r.sender} />
              <span className={`min-w-0 flex-1 truncate ${r.sender === selected ? 'font-medium' : ''}`}>{r.sender}</span>
              <span className="num text-[11px] text-ink-3">{fmtPct(r.n / total, 0)}</span>
            </span>
            <span className="mt-1 ml-4.5 h-0.5 rounded-full bg-line">
              <span className="block h-full rounded-full" style={{ width: `${(r.n / max) * 100}%`, background: colorOf(r.sender) }} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Profile ----------------------------------------------------------------------------

type ProfileKpis = {
  n: number; total: number; words: number; media: number; links: number; calls: number; days: number;
  received: number; given: number; conv_rate: number; first_ts: number; last_ts: number; rank: number; people: number;
};

function Header({ name }: { name: string }) {
  const { conv, replyWindow } = useConversation();
  const p = conv.people.find((x) => x.name === name);
  const P = lit(name);
  const k = useQuery<ProfileKpis>(`
    WITH ranks AS (SELECT sender, count(*) AS n, rank() OVER (ORDER BY count(*) DESC) AS rank FROM span GROUP BY 1)
    SELECT count(*) AS n,
           (SELECT count(*) FROM span) AS total,
           coalesce(sum(words), 0) AS words,
           count(*) FILTER (kind IN ${MEDIA}) AS media,
           count(*) FILTER (kind = 'link') AS links,
           count(*) FILTER (kind = 'call') AS calls,
           count(DISTINCT ts::DATE) AS days,
           (SELECT count(*) FROM span_reactions WHERE receiver = ${P}) AS received,
           (SELECT count(*) FROM span_reactions WHERE actor = ${P}) AS given,
           (SELECT count(*) FROM span_reactions) / greatest(1, (SELECT count(*) FROM span)) * 100 AS conv_rate,
           epoch_ms(min(ts)) AS first_ts, epoch_ms(max(ts)) AS last_ts,
           (SELECT rank FROM ranks WHERE sender = ${P}) AS rank,
           (SELECT count(*) FROM ranks) AS people
    FROM span WHERE sender = ${P}`).data?.[0];
  const reply = useQuery<{ med: number | null; n: number }>(`
    WITH ${repliesCte(replyWindow)} SELECT median(lat_ms) AS med, count(*) AS n FROM replies WHERE replier = ${P}`).data?.[0];
  const rate = k && k.n ? (k.received / k.n) * 100 : null;

  return (
    <>
      <div className="flex items-center gap-3">
        <Badge name={name} size={22} />
        <h2 className="text-[18px] font-semibold">{name}</h2>
        {p?.isMe && <span className="rounded bg-surface-2 px-1.5 text-[11px] text-ink-3">you</span>}
        {p && !p.member && <span className="rounded bg-surface-2 px-1.5 text-[11px] text-ink-3" title="Sent messages but is not in the current member list">no longer a member</span>}
        <span className="num ml-auto text-ink-3">
          {k?.rank ? `#${k.rank} of ${k.people} by messages · ` : ''}
          {k?.n ? `${fmtDate(k.first_ts)} → ${fmtDate(k.last_ts)}` : 'no messages in this range'}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-3 @6xl:grid-cols-8">
        <Stat label="Messages" value={fmtInt(k?.n)} sub={k?.total ? `${fmtPct(k.n / k.total)} of the conversation` : undefined} />
        <Stat label="Words" value={fmtCompact(k?.words)} sub={k?.n ? `${(k.words / k.n).toFixed(1)} per message` : undefined} />
        <Stat label="Active days" value={fmtInt(k?.days)} sub={k?.days ? `${(k.n / k.days).toFixed(1)} messages each` : undefined} />
        <Stat label="Media" value={fmtInt(k?.media)} sub={k?.n ? `${fmtPct(k.media / k.n)} of their messages` : undefined} />
        <Stat label="Links · calls" value={`${fmtInt(k?.links)} · ${fmtInt(k?.calls)}`} sub="shared · started or joined" />
        <Stat label="Reactions received" value={fmtInt(k?.received)} sub={rate !== null && k ? `${rate.toFixed(1)} per 100 msgs (avg ${k.conv_rate.toFixed(1)})` : undefined} />
        <Stat label="Reactions given" value={fmtInt(k?.given)} sub={k?.n ? `${((k.given / k.n) * 100).toFixed(1)} per 100 of their msgs` : undefined} />
        <Stat label="Median reply" value={fmtDuration(reply?.med)} sub={reply ? `${fmtInt(reply.n)} replies` : undefined} />
      </div>
    </>
  );
}

type Traits = {
  s: string; n: number; wpm: number | null; night: number; weekend: number; media: number; questions: number;
  got_pm: number; gave_pm: number; med: number | null; dbl: number | null;
};

const TRAITS: { key: keyof Traits; label: string; fmt: (v: number) => string; lowIsMore?: boolean }[] = [
  { key: 'n', label: 'Messages', fmt: (v) => fmtInt(v) },
  { key: 'wpm', label: 'Words per message', fmt: (v) => v.toFixed(1) },
  { key: 'got_pm', label: 'Reactions received / msg', fmt: (v) => v.toFixed(2) },
  { key: 'gave_pm', label: 'Reactions given / msg', fmt: (v) => v.toFixed(2) },
  { key: 'med', label: 'Reply speed', fmt: (v) => fmtDuration(v), lowIsMore: true },
  { key: 'dbl', label: 'Double-texting', fmt: (v) => fmtPct(v, 0) },
  { key: 'night', label: 'Night messages', fmt: (v) => fmtPct(v, 0) },
  { key: 'weekend', label: 'Weekend messages', fmt: (v) => fmtPct(v, 0) },
  { key: 'media', label: 'Media share', fmt: (v) => fmtPct(v, 1) },
  { key: 'questions', label: 'Questions asked', fmt: (v) => fmtPct(v, 0) },
];

/**
 * Where this person sits on ten traits: every member is a faint dot placed by
 * percentile (so every row shares one 0–100 scale), the person a big one.
 */
function HowTheyCompare({ name }: { name: string }) {
  const t = useChartTheme();
  const { colorOf, replyWindow } = useConversation();
  const q = useQuery<Traits>(`
    WITH ${TURNS_CTE}, ${repliesCte(replyWindow)},
    base AS (
      SELECT sender AS s, count(*) AS n, avg(words) FILTER (kind = 'text') AS wpm,
             count(*) FILTER (hour(ts) >= 23 OR hour(ts) < 5) / count(*) AS night,
             count(*) FILTER (isodow(ts) >= 6) / count(*) AS weekend,
             count(*) FILTER (kind IN ${MEDIA}) / count(*) AS media,
             count(*) FILTER (kind = 'text' AND trim(text) LIKE '%?') / greatest(1, count(*) FILTER (kind = 'text')) AS questions
      FROM span GROUP BY 1 HAVING count(*) >= 20
    ),
    rec AS (SELECT receiver AS s, count(*) AS got FROM span_reactions WHERE actor <> receiver GROUP BY 1),
    giv AS (SELECT actor AS s, count(*) AS gave FROM span_reactions WHERE actor <> receiver GROUP BY 1),
    rep AS (SELECT replier AS s, median(lat_ms) AS med FROM replies GROUP BY 1 HAVING count(*) >= 10),
    tt AS (SELECT sender AS s, count(*) FILTER (n >= 2) / count(*) AS dbl FROM turns GROUP BY 1)
    SELECT base.*, coalesce(rec.got, 0) / base.n AS got_pm, coalesce(giv.gave, 0) / base.n AS gave_pm, rep.med, tt.dbl
    FROM base LEFT JOIN rec USING (s) LEFT JOIN giv USING (s) LEFT JOIN rep USING (s) LEFT JOIN tt USING (s)`);
  const rows = q.data ?? [];
  const option = useMemo(() => {
    const base = baseOption(t);
    const points: { value: [number, number]; name: string; raw: number; rank: number; of: number; me: boolean }[] = [];
    TRAITS.forEach((tr, ti) => {
      const scored = rows.filter((r) => r[tr.key] != null).map((r) => ({ name: r.s, v: Number(r[tr.key]) }));
      // Rank so that "more" is to the right (for reply speed, faster = more).
      const sorted = [...scored].sort((a, b) => (tr.lowIsMore ? b.v - a.v : a.v - b.v));
      sorted.forEach((x, i) => {
        const pct = sorted.length > 1 ? (i / (sorted.length - 1)) * 100 : 50;
        // Deterministic jitter so dots on the same spot don't hide each other.
        const jitter = ((x.name.length * 37 + i * 13) % 7) / 7 - 0.5;
        points.push({ value: [pct, ti + (x.name === name ? 0 : jitter * 0.45)], name: x.name, raw: x.v, rank: sorted.length - i, of: sorted.length, me: x.name === name });
      });
    });
    const others = points.filter((p) => !p.me), mine = points.filter((p) => p.me);
    const tip = (p: { dataIndex: number; seriesIndex: number }) => {
      const d = (p.seriesIndex === 0 ? others : mine)[p.dataIndex];
      const tr = TRAITS[Math.round(d.value[1])];
      return `<div style="font-weight:600;margin-bottom:4px">${esc(d.name)}</div>` + tipRow(colorOf(d.name), tr.fmt(d.raw), tr.label) + tipRow(t.muted, `#${d.rank} of ${d.of}`, tr.lowIsMore ? '(1 = fastest)' : '');
    };
    return {
      ...base,
      grid: { left: 170, right: 60, top: 26, bottom: 24 },
      tooltip: { ...base.tooltip, trigger: 'item', formatter: tip },
      xAxis: {
        type: 'value', min: 0, max: 100, interval: 50, ...base.axisCommon, splitLine: { show: false },
        axisLabel: { ...base.axisCommon.axisLabel, formatter: (v: number) => (v === 0 ? 'least' : v === 100 ? 'most' : v === 50 ? 'median' : '') },
      },
      yAxis: {
        type: 'category', inverse: true, data: TRAITS.map((x) => x.label), ...base.axisCommon, axisLine: { show: false }, axisTick: { show: false },
        splitLine: { show: true, lineStyle: { color: t.grid } },
        axisLabel: { color: t.ink2, fontSize: 11 },
      },
      series: [
        { type: 'scatter', symbolSize: 7, itemStyle: { color: t.muted, opacity: 0.35 }, data: others.map((p) => p.value) },
        {
          type: 'scatter', symbolSize: 15, z: 3,
          itemStyle: { color: colorOf(name), borderColor: t.surface, borderWidth: 2 },
          label: { show: true, position: 'right', color: t.ink, fontSize: 11, fontWeight: 600, formatter: (p: { dataIndex: number }) => TRAITS[Math.round(mine[p.dataIndex].value[1])].fmt(mine[p.dataIndex].raw) },
          data: mine.map((p) => p.value),
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, name, t, colorOf]);
  if (rows.length < 3) return null;
  return (
    <Panel title="How they compare" actions={<span className="text-[11px] text-ink-3">each row ranks everyone with 20+ messages · faint dots = the others · hover for values</span>} bodyClassName="p-2">
      <EChart option={option} height={TRAITS.length * 34 + 50} dimmed={q.loading} />
    </Panel>
  );
}

/** Monthly volume (bars) above share of the conversation (line): two grids, one axis each. */
function VolumeAndShare({ name }: { name: string }) {
  const t = useChartTheme();
  const { colorOf, inspect } = useConversation();
  const P = lit(name);
  const q = useQuery<{ b: number; mine: number; total: number }>(`
    WITH b AS (SELECT range AS b FROM range(date_trunc('month', (SELECT min(ts) FROM span)), (SELECT max(ts) FROM span) + INTERVAL 1 MONTH, INTERVAL 1 MONTH)),
    c AS (SELECT date_trunc('month', ts) AS b, count(*) FILTER (sender = ${P}) AS mine, count(*) AS total FROM span GROUP BY 1)
    SELECT epoch_ms(b.b) AS b, coalesce(c.mine, 0) AS mine, coalesce(c.total, 0) AS total FROM b LEFT JOIN c USING (b) ORDER BY 1`);
  const data = q.data ?? [];
  const label = (ms: number) => { const d = new Date(ms); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
  const option = useMemo(() => {
    const base = baseOption(t);
    const labels = data.map((r) => label(r.b));
    const axis = (i: number) => ({ type: 'category', gridIndex: i, data: labels, ...base.axisCommon, splitLine: { show: false }, axisLabel: { ...base.axisCommon.axisLabel, show: i === 1 } });
    return {
      ...base,
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      grid: [{ left: 48, right: 16, top: 12, height: '48%' }, { left: 48, right: 16, top: '64%', bottom: 24 }],
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: t.axis } },
        formatter: (ps: { dataIndex: number }[]) => {
          const r = data[ps[0].dataIndex];
          return `<div style="margin-bottom:4px;opacity:.7">${esc(label(r.b))}</div>` +
            tipRow(colorOf(name), fmtInt(r.mine), 'messages') +
            tipRow(t.ink2, r.total ? fmtPct(r.mine / r.total, 0) : '–', `of ${fmtInt(r.total)} in the conversation`);
        },
      },
      xAxis: [axis(0), axis(1)],
      yAxis: [
        { type: 'value', gridIndex: 0, ...base.axisCommon, axisLine: { show: false }, name: 'messages', nameTextStyle: { color: t.muted, fontSize: 10, align: 'left' } },
        { type: 'value', gridIndex: 1, max: 100, ...base.axisCommon, axisLine: { show: false }, axisLabel: { ...base.axisCommon.axisLabel, formatter: '{value}%' }, name: 'share', nameTextStyle: { color: t.muted, fontSize: 10, align: 'left' } },
      ],
      series: [
        { type: 'bar', xAxisIndex: 0, yAxisIndex: 0, barCategoryGap: '15%', itemStyle: { color: colorOf(name), borderRadius: [2, 2, 0, 0] }, data: data.map((r) => r.mine) },
        { type: 'line', xAxisIndex: 1, yAxisIndex: 1, symbol: 'none', connectNulls: false, lineStyle: { width: 2, color: colorOf(name) }, data: data.map((r) => (r.total ? (r.mine / r.total) * 100 : null)) },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, t, name, colorOf]);
  return (
    <Panel title="Messages and share of the conversation, by month" actions={<span className="text-[11px] text-ink-3">selected dates · click a month to read</span>} bodyClassName="p-2">
      <EChart
        option={option}
        height={300}
        dimmed={q.loading}
        on={{
          click: (p: { dataIndex: number }) => {
            const r = data[p.dataIndex];
            const next = data[p.dataIndex + 1]?.b ?? r.b + 31 * 86_400_000;
            inspect({ title: `${name} · ${label(r.b)}`, where: `sender = ${P} AND ts >= ${tsLit(r.b)} AND ts < ${tsLit(next)}`, from: 'span' });
          },
        }}
      />
    </Panel>
  );
}

/**
 * This person's daily rhythm against the whole conversation's. The group line
 * includes everyone (this person too), so it stays the same whoever is
 * selected; only the person's line moves.
 */
function HourVsGroup({ name }: { name: string }) {
  const t = useChartTheme();
  const { colorOf } = useConversation();
  const P = lit(name);
  const q = useQuery<{ h: number; mine: number; total: number }>(`
    SELECT hour(ts) AS h, count(*) FILTER (sender = ${P}) AS mine, count(*) AS total FROM span GROUP BY 1`);
  const option = useMemo(() => {
    const base = baseOption(t);
    const mine = new Array(24).fill(0), all = new Array(24).fill(0);
    for (const r of q.data ?? []) {
      mine[r.h] = r.mine;
      all[r.h] = r.total;
    }
    const sm = mine.reduce((a, b) => a + b, 0) || 1, sa = all.reduce((a, b) => a + b, 0) || 1;
    const group = all.map((n) => (n / sa) * 100);
    const person = mine.map((n) => (n / sm) * 100);
    const first = name.split(' ')[0];
    const names = ['Whole conversation', first];
    return {
      ...base,
      grid: { ...base.grid, top: 36 },
      legend: legend(t, names, 'line'),
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: t.axis } },
        formatter: (ps: { dataIndex: number }[]) => {
          const h = ps[0].dataIndex;
          const d = person[h] - group[h];
          return `<div style="margin-bottom:4px;opacity:.7">${hourLabel(h)}–${hourLabel((h + 1) % 24)}</div>` +
            tipRow(colorOf(name), `${person[h].toFixed(1)}%`, `of ${first}’s messages`) +
            tipRow(t.ink2, `${group[h].toFixed(1)}%`, 'of the conversation’s messages') +
            tipRow(t.muted, `${d >= 0 ? '+' : ''}${d.toFixed(1)} pts`, d >= 0 ? `${first} is more active than usual` : `${first} is quieter than usual`);
        },
      },
      xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, h) => hourLabel(h)), boundaryGap: false, ...base.axisCommon, splitLine: { show: false } },
      yAxis: { type: 'value', ...base.axisCommon, axisLine: { show: false }, axisLabel: { ...base.axisCommon.axisLabel, formatter: '{value}%' } },
      series: [
        {
          name: names[0], type: 'line', smooth: 0.25, symbol: 'none',
          lineStyle: { width: 2, color: t.ink2 }, itemStyle: { color: t.ink2 }, areaStyle: { color: t.ink2, opacity: 0.08 },
          data: group,
        },
        {
          name: names[1], type: 'line', smooth: 0.25, symbol: 'none',
          lineStyle: { width: 2.5, color: colorOf(name), type: 'dashed' }, itemStyle: { color: colorOf(name) },
          data: person,
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, t, name, colorOf]);
  return (
    <Panel title="Hour of day vs the whole conversation" actions={<span className="text-[11px] text-ink-3">share of messages per hour · dashed = this person</span>} bodyClassName="p-2">
      <EChart option={option} height={260} dimmed={q.loading} />
    </Panel>
  );
}

/** Diverging bars per other person: left = name → them, right = them → name. */
function Butterfly({ name, title, hint, rows, loading, unit, onPick }: {
  name: string; title: string; hint: string; unit: string; loading: boolean;
  rows: { other: string; out: number; inc: number }[];
  onPick: (other: string) => void;
}) {
  const t = useChartTheme();
  const { colorOf } = useConversation();
  const top = rows.slice(0, 14);
  const ordered = [...top].reverse();
  const first = name.split(' ')[0];
  const option = useMemo(() => {
    const base = baseOption(t);
    const max = Math.max(1, ...top.flatMap((r) => [r.out, r.inc]));
    return {
      ...base,
      grid: { ...base.grid, top: 28, left: 8, right: 8 },
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: t.brush } },
        formatter: (ps: { dataIndex: number }[]) => {
          const r = ordered[ps[0].dataIndex];
          return `<div style="margin-bottom:4px;font-weight:600">${esc(r.other)}</div>` +
            tipRow(colorOf(name), fmtInt(r.out), `${unit} from ${first}`) + tipRow(colorOf(r.other), fmtInt(r.inc), `${unit} to ${first}`);
        },
      },
      xAxis: { type: 'value', min: -max, max, ...base.axisCommon, axisLabel: { ...base.axisCommon.axisLabel, formatter: (v: number) => fmtCompact(Math.abs(v)) } },
      yAxis: { type: 'category', data: ordered.map((r) => r.other), ...base.axisCommon, axisLine: { show: false }, axisLabel: { show: false } },
      graphic: [
        { type: 'text', left: 12, top: 4, style: { text: `← ${first} to them`, fill: t.muted, fontSize: 11 } },
        { type: 'text', right: 12, top: 4, style: { text: `them to ${first} →`, fill: t.muted, fontSize: 11 } },
      ],
      series: [
        {
          type: 'bar', stack: 'x', barMaxWidth: 14,
          data: ordered.map((r) => ({ value: -r.out, itemStyle: { color: colorOf(name), borderRadius: [3, 0, 0, 3] } })),
          label: { show: true, position: 'insideRight', color: t.ink, fontSize: 10, formatter: (p: { dataIndex: number }) => ordered[p.dataIndex].other.split(' ')[0] },
        },
        { type: 'bar', stack: 'x', barMaxWidth: 14, data: ordered.map((r) => ({ value: r.inc, itemStyle: { color: colorOf(r.other), borderRadius: [0, 3, 3, 0] } })) },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, t, name, colorOf]);
  return (
    <Panel title={title} actions={<span className="text-[11px] text-ink-3">{hint}</span>} bodyClassName="p-2">
      {top.length ? (
        <EChart option={option} height={Math.max(160, top.length * 26 + 48)} dimmed={loading} on={{ click: (p: { dataIndex: number }) => onPick(ordered[p.dataIndex].other) }} />
      ) : (
        <div className="p-3 text-ink-3">Nothing in this range.</div>
      )}
    </Panel>
  );
}

function RepliesWith({ name }: { name: string }) {
  const { replyWindow, inspect } = useConversation();
  const P = lit(name);
  const q = useQuery<{ other: string; out: number; inc: number; med_out: number | null; med_in: number | null }>(`
    WITH ${repliesCte(replyWindow)}
    SELECT other, sum(o) AS out, sum(i) AS inc, median(lo) AS med_out, median(li) AS med_in FROM (
      SELECT target AS other, 1 AS o, 0 AS i, lat_ms AS lo, NULL AS li FROM replies WHERE replier = ${P}
      UNION ALL SELECT replier, 0, 1, NULL, lat_ms FROM replies WHERE target = ${P}
    ) GROUP BY 1 ORDER BY out + inc DESC`);
  const rows = q.data ?? [];
  return (
    <div className="grid grid-cols-1 gap-3 @5xl:grid-cols-[3fr_2fr]">
      <Butterfly
        name={name}
        title="Replies, with each person"
        hint="click to read their exchanges"
        unit="replies"
        rows={rows}
        loading={q.loading}
        onPick={(other) =>
          inspect({
            title: `${name} ↔ ${other}`,
            where: replyPairWhere(replyWindow, name, other),
            from: 'span',
          })
        }
      />
      <Panel title="Reply speed, with each person">
        <div className={`max-h-[400px] overflow-auto ${q.loading ? 'opacity-50' : ''}`}>
          <table className="w-full border-collapse text-[12px]">
            <thead className="sticky top-0 bg-surface text-ink-3">
              <tr>
                <th className="border-b border-line px-3 py-1.5 text-left font-medium">With</th>
                <th className="border-b border-line px-3 py-1.5 text-right font-medium">{name.split(' ')[0]} replies in</th>
                <th className="border-b border-line px-3 py-1.5 text-right font-medium">They reply in</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((r) => (
                <tr key={r.other}>
                  <td className="max-w-40 truncate border-b border-line/60 px-3 py-1">{r.other}</td>
                  <td className="num border-b border-line/60 px-3 text-right">{fmtDuration(r.med_out)}</td>
                  <td className="num border-b border-line/60 px-3 text-right">{fmtDuration(r.med_in)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function ReactionsWith({ name }: { name: string }) {
  const { inspect } = useConversation();
  const P = lit(name);
  const pairs = useQuery<{ other: string; out: number; inc: number }>(`
    SELECT other, sum(o) AS out, sum(i) AS inc FROM (
      SELECT receiver AS other, 1 AS o, 0 AS i FROM span_reactions WHERE actor = ${P} AND receiver <> ${P}
      UNION ALL SELECT actor, 0, 1 FROM span_reactions WHERE receiver = ${P} AND actor <> ${P}
    ) GROUP BY 1 ORDER BY out + inc DESC`);
  const emoji = useQuery<{ dir: string; reaction: string; n: number }>(`
    SELECT * FROM (
      SELECT dir, reaction, count(*) AS n, row_number() OVER (PARTITION BY dir ORDER BY count(*) DESC) AS r FROM (
        SELECT 'given' AS dir, reaction FROM span_reactions WHERE actor = ${P}
        UNION ALL SELECT 'received', reaction FROM span_reactions WHERE receiver = ${P}
      ) GROUP BY 1, 2
    ) WHERE r <= 10 ORDER BY dir, n DESC`);
  const list = (dir: string) => emoji.data?.filter((e) => e.dir === dir) ?? [];
  const EmojiList = ({ dir, label }: { dir: string; label: string }) => {
    const items = list(dir);
    const max = items[0]?.n ?? 1;
    return (
      <div className="min-w-0 flex-1">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-3">{label}</div>
        {items.map((e) => (
          <div key={e.reaction} className="flex h-6 items-center gap-2">
            <span className="w-6 text-center text-[15px]">{e.reaction}</span>
            <span className="h-1.5 flex-1 rounded-full bg-surface-2"><span className="block h-full rounded-full bg-accent" style={{ width: `${(e.n / max) * 100}%` }} /></span>
            <span className="num w-12 text-right text-ink-2">{fmtInt(e.n)}</span>
          </div>
        ))}
        {!items.length && <div className="text-ink-3">None.</div>}
      </div>
    );
  };
  return (
    <div className="grid grid-cols-1 gap-3 @5xl:grid-cols-[3fr_2fr]">
      <Butterfly
        name={name}
        title="Reactions, with each person"
        hint="click to read the reacted messages"
        unit="reactions"
        rows={pairs.data ?? []}
        loading={pairs.loading}
        onPick={(other) =>
          inspect({
            title: `Reactions between ${name} and ${other}`,
            where: `message_id IN (SELECT message_id FROM span_reactions WHERE (actor = ${P} AND receiver = ${lit(other)}) OR (actor = ${lit(other)} AND receiver = ${P}))`,
            from: 'span',
          })
        }
      />
      <Panel title="Favourite reactions" bodyClassName="flex gap-6 p-3">
        <EmojiList dir="given" label="Gives" />
        <EmojiList dir="received" label="Gets" />
      </Panel>
    </div>
  );
}

function TopReacted({ name }: { name: string }) {
  const { inspect } = useConversation();
  const P = lit(name);
  const q = useQuery<{ message_id: number; ts: number; text: string | null; kind: string; n: number; emojis: string; atts: string | null }>(`
    SELECT m.message_id, epoch_ms(m.ts) AS ts, m.text, m.kind, count(*) AS n, string_agg(r.reaction, '') AS emojis,
           (SELECT to_json(list({'t': type, 'u': uri} ORDER BY uri))::VARCHAR FROM attachments a WHERE a.message_id = m.message_id) AS atts
    FROM span m JOIN reactions r USING (message_id)
    WHERE m.sender = ${P} GROUP BY 1, 2, 3, 4 ORDER BY n DESC, ts DESC LIMIT 10`);
  return (
    <Panel title="Their most reacted messages" actions={<span className="text-[11px] text-ink-3">click to read the moment</span>}>
      <div className={q.loading ? 'opacity-50' : ''}>
        {q.data?.map((m) => (
          <button
            key={m.message_id}
            onClick={() => inspect({ title: `Around ${fmtDate(m.ts)}`, where: `ts BETWEEN ${tsLit(m.ts - 15 * 60_000)} AND ${tsLit(m.ts + 15 * 60_000)}`, from: 'span' })}
            className="flex w-full items-start gap-3 border-b border-line/60 px-3 py-2 text-left hover:bg-surface-2"
          >
            <span className="num w-8 shrink-0 text-right font-semibold">{m.n}</span>
            <MessagePreview text={m.text} kind={m.kind} atts={m.atts} />
            <span className="shrink-0 text-[13px]">{[...new Set(m.emojis)].slice(0, 6).join('')}</span>
            <span className="num w-24 shrink-0 text-right text-[11px] text-ink-3">{fmtDate(m.ts)}</span>
          </button>
        ))}
        {q.data?.length === 0 && <div className="p-3 text-ink-3">No reactions in this range.</div>}
      </div>
    </Panel>
  );
}

export function People({ who, setWho }: { who?: string; setWho: (name: string) => void }) {
  const { conv } = useConversation();
  const active = conv.people.filter((p) => p.messages > 0);
  // Default to the most active person who isn't you.
  const fallback = active.find((p) => !p.isMe)?.name ?? active[0]?.name;
  const name = who && active.some((p) => p.name === who) ? who : fallback;
  if (!name) return <div className="p-6 text-ink-3">No one has written in this conversation.</div>;
  return (
    <div className="flex h-full">
      <PeopleList selected={name} onSelect={setWho} />
      <div className="@container min-w-0 flex-1 overflow-auto">
        <div className="space-y-3 p-4">
          <Header name={name} />
          <HowTheyCompare name={name} />
          <VolumeAndShare name={name} />
          <div className="grid grid-cols-1 gap-3 @5xl:grid-cols-[3fr_2fr]">
            <HourVsGroup name={name} />
            <TopReacted name={name} />
          </div>
          <div className="pt-1"><ReplyWindowControl /></div>
          <RepliesWith name={name} />
          <ReactionsWith name={name} />
        </div>
      </div>
    </div>
  );
}
