// People: one profile per person. Volume, rhythm, and their relation to
// each other member. Profiles read `span` (date filter only) so a person
// stays comparable to everyone else whatever the people filter says.
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useConversation } from '../app/ConversationProvider';
import { repliesCte, replyPairWhere } from '../app/relations';
import { EChart } from '../charts/EChart';
import { baseOption, esc, legend, tipRow, useChartTheme } from '../charts/theme';
import { lit } from '../db/duckdb';
import { useQuery } from '../db/useQuery';
import { fmtCompact, fmtDate, fmtInt, fmtPct } from '../lib/format';
import { fmtDuration, hourLabel, MONTHS, tsLit } from '../lib/time';
import { Panel, Stat } from '../ui/primitives';
import { ReplyWindowControl } from './Relations';
import { Badge } from '../ui/Badge';

const MEDIA = "('photo','video','gif','sticker','audio','file')";

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

/** Monthly volume (bars) above share of the conversation (line): two grids, one axis each. */
function VolumeAndShare({ name }: { name: string }) {
  const t = useChartTheme();
  const { colorOf, inspect } = useConversation();
  const P = lit(name);
  const q = useQuery<{ b: number; mine: number; total: number }>(`
    WITH b AS (SELECT range AS b FROM range(date_trunc('month', (SELECT min(ts) FROM conv)), (SELECT max(ts) FROM conv) + INTERVAL 1 MONTH, INTERVAL 1 MONTH)),
    c AS (SELECT date_trunc('month', ts) AS b, count(*) FILTER (sender = ${P}) AS mine, count(*) AS total FROM conv GROUP BY 1)
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
    <Panel title="Messages and share of the conversation, by month" actions={<span className="text-[11px] text-ink-3">whole conversation · click a month to read</span>} bodyClassName="p-2">
      <EChart
        option={option}
        height={300}
        dimmed={q.loading}
        on={{
          click: (p: { dataIndex: number }) => {
            const r = data[p.dataIndex];
            const next = data[p.dataIndex + 1]?.b ?? r.b + 31 * 86_400_000;
            inspect({ title: `${name} · ${label(r.b)}`, where: `sender = ${P} AND ts >= ${tsLit(r.b)} AND ts < ${tsLit(next)}`, from: 'ctx' });
          },
        }}
      />
    </Panel>
  );
}

function HourVsRest({ name }: { name: string }) {
  const t = useChartTheme();
  const { colorOf } = useConversation();
  const P = lit(name);
  const q = useQuery<{ h: number; mine: number; rest: number }>(`
    SELECT hour(ts) AS h, count(*) FILTER (sender = ${P}) AS mine, count(*) FILTER (sender <> ${P}) AS rest FROM span GROUP BY 1`);
  const option = useMemo(() => {
    const base = baseOption(t);
    const mine = new Array(24).fill(0), rest = new Array(24).fill(0);
    for (const r of q.data ?? []) (mine[r.h] = r.mine), (rest[r.h] = r.rest);
    const sm = mine.reduce((a, b) => a + b, 0) || 1, sr = rest.reduce((a, b) => a + b, 0) || 1;
    const names = [name, 'Everyone else'];
    return {
      ...base,
      grid: { ...base.grid, top: 36 },
      legend: legend(t, names, 'line'),
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: t.axis } },
        formatter: (ps: { seriesName: string; value: number; color: string; dataIndex: number }[]) =>
          `<div style="margin-bottom:4px;opacity:.7">${hourLabel(ps[0].dataIndex)}</div>` + ps.map((p) => tipRow(p.color, `${p.value.toFixed(1)}%`, p.seriesName)).join(''),
      },
      xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, h) => hourLabel(h)), boundaryGap: false, ...base.axisCommon, splitLine: { show: false } },
      yAxis: { type: 'value', ...base.axisCommon, axisLine: { show: false }, axisLabel: { ...base.axisCommon.axisLabel, formatter: '{value}%' } },
      series: [
        { name, type: 'line', smooth: 0.25, symbol: 'none', lineStyle: { width: 2, color: colorOf(name) }, itemStyle: { color: colorOf(name) }, areaStyle: { color: colorOf(name), opacity: 0.12 }, data: mine.map((n) => (n / sm) * 100) },
        { name: 'Everyone else', type: 'line', smooth: 0.25, symbol: 'none', lineStyle: { width: 2, color: t.muted, type: 'dashed' }, itemStyle: { color: t.muted }, data: rest.map((n) => (n / sr) * 100) },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, t, name, colorOf]);
  return (
    <Panel title="Hour of day vs everyone else" bodyClassName="p-2">
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
  const q = useQuery<{ message_id: number; ts: number; text: string | null; kind: string; n: number; emojis: string }>(`
    SELECT m.message_id, epoch_ms(m.ts) AS ts, m.text, m.kind, count(*) AS n, string_agg(r.reaction, '') AS emojis
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
            <span className={`min-w-0 flex-1 ${m.text ? '' : 'italic text-ink-3'}`}>{m.text ?? m.kind}</span>
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
          <VolumeAndShare name={name} />
          <div className="grid grid-cols-1 gap-3 @5xl:grid-cols-[3fr_2fr]">
            <HourVsRest name={name} />
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
