// Reactions: what people react with, to whom, and which messages landed.
// Like Relations, this reads `span` so the people filter keeps reactions
// where either side (reactor or author) is selected.
import { useMemo, useState } from 'react';
import { pairPeopleSql, useConversation } from '../app/ConversationProvider';
import { matrixPeople } from '../app/relations';
import { EChart } from '../charts/EChart';
import { gridHeatmap, personHeatmap, quantile, rowHeight } from '../charts/heatmap';
import { baseOption, esc, tipRow, useChartTheme } from '../charts/theme';
import { lit } from '../db/duckdb';
import { useQuery } from '../db/useQuery';
import { fmtDate, fmtInt, fmtPct } from '../lib/format';
import { tsLit } from '../lib/time';
import { Panel, Segmented, Stat } from '../ui/primitives';
import { MessagePreview } from '../media/MessagePreview';
import { Badge } from '../ui/Badge';

function useWhere() {
  const { filters } = useConversation();
  return pairPeopleSql(filters, 'actor', 'receiver');
}

function KpiRow() {
  const where = useWhere();
  const { filters } = useConversation();
  const authors = filters.people.length ? `sender IN (${filters.people.map(lit).join(', ')})` : 'TRUE';
  const k = useQuery<{ n: number; msgs: number; reacted: number; kinds: number; top: string | null; top_n: number; best: number }>(`
    WITH r AS (SELECT * FROM span_reactions WHERE ${where}),
    m AS (SELECT message_id, n_reactions FROM span WHERE ${authors})
    SELECT (SELECT count(*) FROM r) AS n,
           (SELECT count(*) FROM m) AS msgs,
           (SELECT count(*) FROM m WHERE n_reactions > 0) AS reacted,
           (SELECT count(DISTINCT reaction) FROM r) AS kinds,
           (SELECT reaction FROM r GROUP BY 1 ORDER BY count(*) DESC LIMIT 1) AS top,
           (SELECT count(*) FROM r GROUP BY reaction ORDER BY count(*) DESC LIMIT 1) AS top_n,
           (SELECT coalesce(max(n_reactions), 0) FROM m) AS best`).data?.[0];
  return (
    <div className="grid grid-cols-3 gap-3 @5xl:grid-cols-6">
      <Stat label="Reactions" value={fmtInt(k?.n)} sub={k?.msgs ? `${((k.n / k.msgs) * 100).toFixed(1)} per 100 messages` : undefined} />
      <Stat label="Messages reacted to" value={k?.msgs ? fmtPct(k.reacted / k.msgs) : '–'} sub={k ? `${fmtInt(k.reacted)} of ${fmtInt(k.msgs)}` : undefined} />
      <Stat label="Favourite" value={k?.top ?? '–'} sub={k?.n ? `${fmtPct(k.top_n / k.n, 0)} of all reactions` : undefined} />
      <Stat label="Different reactions" value={fmtInt(k?.kinds)} sub="distinct emoji" />
      <Stat label="Most on one message" value={fmtInt(k?.best)} sub="reactions" />
      <Stat label="Per reacted message" value={k?.reacted ? (k.n / k.reacted).toFixed(2) : '–'} sub="reactions on average" />
    </div>
  );
}

function TopReactions() {
  const t = useChartTheme();
  const where = useWhere();
  const { inspect } = useConversation();
  const q = useQuery<{ reaction: string; n: number }>(`
    SELECT reaction, count(*) AS n FROM span_reactions WHERE ${where} GROUP BY 1 ORDER BY n DESC LIMIT 15`);
  const rows = [...(q.data ?? [])].reverse();
  const total = rows.reduce((a, r) => a + r.n, 0);
  const option = useMemo(() => {
    const base = baseOption(t);
    return {
      ...base,
      grid: { ...base.grid, right: 72 },
      tooltip: { ...base.tooltip, trigger: 'item', formatter: (p: { dataIndex: number }) => tipRow(t.series[0], fmtInt(rows[p.dataIndex].n), `${rows[p.dataIndex].reaction} reactions`) },
      xAxis: { type: 'value', ...base.axisCommon, axisLabel: { show: false }, splitLine: { show: false } },
      yAxis: { type: 'category', data: rows.map((r) => r.reaction), ...base.axisCommon, axisLine: { show: false }, axisLabel: { fontSize: 16, color: t.ink } },
      series: [{
        type: 'bar', barMaxWidth: 16, itemStyle: { color: t.series[0], borderRadius: [0, 3, 3, 0] }, data: rows.map((r) => r.n),
        label: { show: true, position: 'right', color: t.ink2, fontSize: 11, formatter: (p: { value: number }) => `${fmtInt(p.value)} · ${fmtPct(p.value / total, 0)}` },
      }],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, t]);
  return (
    <Panel title="Top reactions" actions={<span className="text-[11px] text-ink-3">click to read the messages</span>} bodyClassName="p-2">
      <EChart
        option={option}
        height={Math.max(200, rows.length * 26 + 24)}
        dimmed={q.loading}
        on={{
          click: (p: { dataIndex: number }) => {
            const r = rows[p.dataIndex].reaction;
            inspect({ title: `Messages that got ${r}`, where: `message_id IN (SELECT message_id FROM span_reactions WHERE reaction = ${lit(r)} AND ${where})`, from: 'span' });
          },
        }}
      />
    </Panel>
  );
}

function ReactionByPerson() {
  const t = useChartTheme();
  const where = useWhere();
  const { conv, inspect, colorOf } = useConversation();
  const { names, fold } = matrixPeople(conv);
  const top = useQuery<{ reaction: string }>(`SELECT reaction FROM span_reactions WHERE ${where} GROUP BY 1 ORDER BY count(*) DESC LIMIT 10`).data ?? [];
  const emojis = top.map((r) => r.reaction);
  const q = useQuery<{ s: string; reaction: string; n: number }>(
    emojis.length
      ? `SELECT ${fold('actor')} AS s, reaction, count(*) AS n FROM span_reactions
         WHERE ${where} AND reaction IN (${emojis.map(lit).join(', ')}) GROUP BY 1, 2`
      : null,
  );
  const rows = [...names].reverse();
  const option = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of q.data ?? []) totals.set(r.s, (totals.get(r.s) ?? 0) + r.n);
    const cells = (q.data ?? [])
      .map((r) => [emojis.indexOf(r.reaction), rows.indexOf(r.s), (r.n / totals.get(r.s)!) * 100] as [number, number, number])
      .filter((c) => c[0] >= 0 && c[1] >= 0);
    const o = gridHeatmap(t, {
      x: emojis, y: rows, cells, yName: 'who reacts ↓', yColors: rows.map(colorOf),
      max: quantile(cells.map((c) => c[2]), 0.97),
      title: (x, y) => `${y} · ${x}`,
      value: (v) => `${v.toFixed(0)}% of their reactions`,
      legend: ['more', 'less'],
    });
    return { ...o, xAxis: { ...o.xAxis, axisLabel: { ...o.xAxis.axisLabel, fontSize: 16, color: t.ink } } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, t, emojis.join(), names.join(), colorOf]);
  return (
    <Panel title="Who uses which reaction" actions={<span className="text-[11px] text-ink-3">each row sums to 100% over these 10 · click to read</span>} bodyClassName="p-2">
      <EChart
        option={option}
        height={Math.max(220, rows.length * rowHeight(rows.length) + 90)}
        dimmed={q.loading}
        on={{
          click: (p: { value: [number, number, number] }) => {
            const [e, who] = [emojis[p.value[0]], rows[p.value[1]]];
            inspect({ title: `${who} reacting ${e}`, where: `message_id IN (SELECT message_id FROM span_reactions WHERE actor = ${lit(who)} AND reaction = ${lit(e)})`, from: 'span' });
          },
        }}
      />
    </Panel>
  );
}

/** Messages sent and reactions received per person (all types, not counting reacting to yourself). */
function useReceived() {
  const { filters } = useConversation();
  return useQuery<{ s: string; n: number; got: number }>(`
    WITH m AS (SELECT sender AS s, count(*) AS n FROM span GROUP BY 1),
    r AS (SELECT receiver AS s, count(*) AS got FROM span_reactions WHERE actor <> receiver GROUP BY 1)
    SELECT m.s, m.n, coalesce(r.got, 0) AS got FROM m LEFT JOIN r USING (s)
    WHERE ${pairPeopleSql(filters, 'm.s', 'm.s')}`);
}

/** Everyone ranked by total reactions received, with their per-message rate. */
function ReceivedTotals({ openPerson }: { openPerson: (name: string) => void }) {
  const t = useChartTheme();
  const { colorOf } = useConversation();
  const q = useReceived();
  const rows = [...(q.data ?? [])].sort((a, b) => b.got - a.got);
  const ordered = [...rows].reverse();
  const total = rows.reduce((a, r) => a + r.got, 0);
  const option = useMemo(() => {
    const base = baseOption(t);
    return {
      ...base,
      grid: { ...base.grid, right: 104 },
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (p: { dataIndex: number }) => {
          const r = ordered[p.dataIndex];
          return `<div style="font-weight:600;margin-bottom:4px">${esc(r.s)}</div>` +
            tipRow(colorOf(r.s), fmtInt(r.got), `reactions received · ${fmtPct(r.got / Math.max(1, total), 1)} of all`) +
            tipRow(t.ink2, (r.got / r.n).toFixed(2), `per message (${fmtInt(r.n)} messages)`);
        },
      },
      xAxis: { type: 'value', ...base.axisCommon, axisLabel: { show: false }, splitLine: { show: false } },
      yAxis: { type: 'category', data: ordered.map((r) => r.s), ...base.axisCommon, axisLine: { show: false }, axisLabel: { color: t.ink2, fontSize: 11, width: 120, overflow: 'truncate' } },
      series: [{
        type: 'bar',
        barMaxWidth: 16,
        data: ordered.map((r) => ({ value: r.got, itemStyle: { color: colorOf(r.s), borderRadius: [0, 3, 3, 0] } })),
        label: {
          show: true, position: 'right', color: t.ink2, fontSize: 11,
          formatter: (p: { dataIndex: number }) => `${fmtInt(ordered[p.dataIndex].got)} · ${(ordered[p.dataIndex].got / ordered[p.dataIndex].n).toFixed(2)}/msg`,
        },
      }],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, t, colorOf]);
  return (
    <Panel title="Reactions received, by person" actions={<span className="text-[11px] text-ink-3">total · per message · click for profile</span>} bodyClassName="p-2">
      <EChart option={option} height={Math.max(380, rows.length * 22 + 24)} dimmed={q.loading} on={{ click: (p: { dataIndex: number }) => openPerson(ordered[p.dataIndex].s) }} />
    </Panel>
  );
}

/**
 * Who gets the most out of each message: messages sent against reactions
 * received per message (all reaction types, not counting reacting to
 * yourself). The dashed line is the group's average.
 */
function MessagesVsReactions({ openPerson }: { openPerson: (name: string) => void }) {
  const t = useChartTheme();
  const { colorOf } = useConversation();
  const [min, setMin] = useState<'20' | '100' | '500'>('20');
  const q = useReceived();
  const all = q.data ?? [];
  const rows = all.filter((r) => r.n >= Number(min));
  const avg = all.reduce((a, r) => a + r.got, 0) / Math.max(1, all.reduce((a, r) => a + r.n, 0));
  const option = useMemo(() => {
    const base = baseOption(t);
    const maxGot = Math.max(1, ...rows.map((r) => r.got));
    // Name the 15 biggest senders and the 5 best ratios; everyone else is named on hover.
    const named = new Set([
      ...[...rows].sort((a, b) => b.n - a.n).slice(0, 15).map((r) => r.s),
      ...[...rows].sort((a, b) => b.got / b.n - a.got / a.n).slice(0, 5).map((r) => r.s),
    ]);
    return {
      ...base,
      grid: { ...base.grid, left: 16, right: 40, top: 28, bottom: 28 },
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (p: { dataIndex: number }) => {
          const r = rows[p.dataIndex];
          const ratio = r.got / r.n;
          return `<div style="font-weight:600;margin-bottom:4px">${esc(r.s)}</div>` +
            tipRow(colorOf(r.s), ratio.toFixed(2), 'reactions per message') +
            tipRow(t.ink2, fmtInt(r.n), 'messages sent') +
            tipRow(t.ink2, fmtInt(r.got), 'reactions received') +
            tipRow(t.muted, `${(ratio / avg).toFixed(1)}×`, `the group average (${avg.toFixed(2)})`);
        },
      },
      xAxis: {
        type: 'log', logBase: 10, name: 'messages sent →', nameLocation: 'end', nameTextStyle: { color: t.muted, fontSize: 11 },
        ...base.axisCommon, axisLabel: { ...base.axisCommon.axisLabel, formatter: (v: number) => fmtInt(v) },
      },
      yAxis: {
        type: 'value', min: 0, name: 'reactions per message ↑', nameTextStyle: { color: t.muted, fontSize: 11, align: 'left' },
        ...base.axisCommon, axisLine: { show: false },
      },
      series: [{
        type: 'scatter',
        data: rows.map((r) => ({
          value: [r.n, r.got / r.n],
          symbolSize: 9 + 26 * Math.sqrt(r.got / maxGot),
          itemStyle: { color: colorOf(r.s), borderColor: t.surface, borderWidth: 2, opacity: 0.9 },
          label: { show: named.has(r.s), position: 'right', color: t.ink2, fontSize: 11, formatter: r.s.split(' ')[0] },
        })),
        emphasis: { scale: 1.15 },
        markLine: {
          silent: true, symbol: 'none', lineStyle: { color: t.muted, type: 'dashed' },
          label: { formatter: `group average ${avg.toFixed(2)}`, color: t.muted, fontSize: 10, position: 'insideEndTop' },
          data: [{ yAxis: avg }],
        },
      }],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, min, t, colorOf]);
  return (
    <Panel
      title="Messages sent vs reactions received per message"
      actions={
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-ink-3" title="All reaction types. Above the dashed line = more reactions per message than the group average. Dot size = total reactions received. Click a dot for the profile.">above the line = above average</span>
          <span className="text-[11px] text-ink-3">min. messages</span>
          <Segmented value={min} options={['20', '100', '500']} onChange={setMin} />
        </div>
      }
      bodyClassName="p-2"
    >
      {/* Same height as the ranked list beside it, so the two panels line up. */}
      <EChart option={option} height={Math.max(380, all.length * 22 + 24)} dimmed={q.loading} on={{ click: (p: { dataIndex: number }) => openPerson(rows[p.dataIndex].s) }} />
      {!q.loading && !rows.length && <div className="p-3 text-ink-3">Nobody has {min}+ messages in this selection.</div>}
    </Panel>
  );
}

/** Reactions given vs received, both per 100 of the person's own messages. */
function GenerousVsAppreciated({ openPerson }: { openPerson: (name: string) => void }) {
  const t = useChartTheme();
  const { colorOf, filters } = useConversation();
  const q = useQuery<{ s: string; msgs: number; given: number; received: number }>(`
    WITH m AS (SELECT sender AS s, count(*) AS msgs FROM span GROUP BY 1),
    g AS (SELECT actor AS s, count(*) AS given FROM span_reactions GROUP BY 1),
    r AS (SELECT receiver AS s, count(*) AS received FROM span_reactions GROUP BY 1)
    SELECT m.s, m.msgs, coalesce(g.given, 0) AS given, coalesce(r.received, 0) AS received
    FROM m LEFT JOIN g USING (s) LEFT JOIN r USING (s)
    WHERE m.msgs >= 20 AND ${pairPeopleSql(filters, 'm.s', 'm.s')}`);
  const rows = q.data ?? [];
  const option = useMemo(() => {
    const base = baseOption(t);
    const maxMsgs = Math.max(1, ...rows.map((r) => r.msgs));
    const labelFloor = [...rows].sort((a, b) => b.msgs - a.msgs)[Math.min(14, rows.length - 1)]?.msgs ?? 0;
    return {
      ...base,
      grid: { ...base.grid, left: 16, right: 24, top: 24, bottom: 24 },
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (p: { dataIndex: number }) => {
          const r = rows[p.dataIndex];
          return `<div style="font-weight:600;margin-bottom:4px">${esc(r.s)}</div>` +
            tipRow(colorOf(r.s), ((r.given / r.msgs) * 100).toFixed(1), 'reactions given per 100 of their messages') +
            tipRow(colorOf(r.s), ((r.received / r.msgs) * 100).toFixed(1), 'reactions received per 100 of their messages') +
            tipRow(t.ink2, fmtInt(r.msgs), 'messages');
        },
      },
      xAxis: { type: 'value', name: 'gives →', nameLocation: 'end', nameTextStyle: { color: t.muted, fontSize: 11 }, ...base.axisCommon, splitLine: { lineStyle: { color: t.grid } } },
      yAxis: { type: 'value', name: 'gets ↑', nameTextStyle: { color: t.muted, fontSize: 11, align: 'left' }, ...base.axisCommon, axisLine: { show: false } },
      series: [{
        type: 'scatter',
        data: rows.map((r) => ({
          value: [(r.given / r.msgs) * 100, (r.received / r.msgs) * 100],
          symbolSize: 10 + 26 * Math.sqrt(r.msgs / maxMsgs),
          itemStyle: { color: colorOf(r.s), borderColor: t.surface, borderWidth: 2, opacity: 0.9 },
          // Name the 15 biggest senders; everyone else is named on hover.
          label: { show: r.msgs >= labelFloor, position: 'right', color: t.ink2, fontSize: 11, formatter: r.s.split(' ')[0] },
        })),
        emphasis: { scale: 1.15 },
      }],
    };
  }, [rows, t, colorOf]);
  return (
    <Panel title="Generous vs appreciated" actions={<span className="text-[11px] text-ink-3">per 100 of each person’s messages · size = messages · click for profile</span>} bodyClassName="p-2">
      <EChart option={option} height={340} dimmed={q.loading} on={{ click: (p: { dataIndex: number }) => openPerson(rows[p.dataIndex].s) }} />
    </Panel>
  );
}

function RateByYear() {
  const t = useChartTheme();
  const { seriesNames, colorOf, filters } = useConversation();
  const q = useQuery<{ s: string; y: number; msgs: number; got: number }>(`
    SELECT sender AS s, year(ts) AS y, count(*) AS msgs, sum(n_reactions) AS got FROM span
    WHERE ${pairPeopleSql(filters, 'sender', 'sender')} GROUP BY 1, 2 HAVING count(*) >= 20`);
  const { option, height } = useMemo(() => {
    const data = q.data ?? [];
    const years = [...new Set(data.map((r) => r.y))].sort();
    const values = new Map<string, number[]>();
    for (const r of data) {
      let arr = values.get(r.s);
      if (!arr) values.set(r.s, (arr = new Array(years.length).fill(null)));
      arr[years.indexOf(r.y)] = (r.got / r.msgs) * 100;
    }
    return personHeatmap(t, {
      people: seriesNames, colorOf, x: years.map(String), values,
      title: (x, p) => `${p} · ${x}`,
      value: (v) => `${v.toFixed(1)} reactions per 100 messages`,
      legend: ['more', 'less'],
    });
  }, [q.data, seriesNames, colorOf, t]);
  return (
    <Panel title="Reactions received per 100 messages, by year" actions={<span className="text-[11px] text-ink-3">years with 20+ messages</span>} bodyClassName="p-2">
      <EChart option={option} height={Math.max(340, height)} dimmed={q.loading} />
    </Panel>
  );
}

function MostReacted() {
  const { inspect, filters } = useConversation();
  const where = useWhere();
  const [emoji, setEmoji] = useState<string | null>(null);
  const chips = useQuery<{ reaction: string }>(`SELECT reaction FROM span_reactions WHERE ${where} GROUP BY 1 ORDER BY count(*) DESC LIMIT 8`).data ?? [];
  const authors = filters.people.length ? `m.sender IN (${filters.people.map(lit).join(', ')})` : 'TRUE';
  const q = useQuery<{ message_id: number; ts: number; sender: string; text: string | null; kind: string; n: number; emojis: string; atts: string | null }>(`
    SELECT m.message_id, epoch_ms(m.ts) AS ts, m.sender, m.text, m.kind,
           count(*) ${emoji ? `FILTER (r.reaction = ${lit(emoji)})` : ''} AS n, string_agg(r.reaction, '') AS emojis,
           (SELECT to_json(list({'t': type, 'u': uri} ORDER BY uri))::VARCHAR FROM attachments a WHERE a.message_id = m.message_id) AS atts
    FROM span m JOIN reactions r USING (message_id)
    WHERE ${authors} GROUP BY 1, 2, 3, 4, 5 HAVING n > 0 ORDER BY n DESC, ts DESC LIMIT 30`);
  return (
    <Panel
      title="Most reacted messages"
      actions={
        <div className="flex items-center gap-1">
          <button onClick={() => setEmoji(null)} className={`h-6 rounded px-2 text-[11px] ${emoji === null ? 'bg-accent-soft font-medium' : 'text-ink-3 hover:text-ink'}`}>All</button>
          {chips.map((c) => (
            <button key={c.reaction} onClick={() => setEmoji(c.reaction)} className={`h-6 rounded px-1.5 text-[14px] ${emoji === c.reaction ? 'bg-accent-soft' : 'opacity-70 hover:opacity-100'}`}>{c.reaction}</button>
          ))}
        </div>
      }
    >
      <div className={`max-h-[520px] overflow-auto ${q.loading ? 'opacity-50' : ''}`}>
        {q.data?.map((m) => (
          <button
            key={m.message_id}
            onClick={() => inspect({ title: `Around ${fmtDate(m.ts)}`, where: `ts BETWEEN ${tsLit(m.ts - 15 * 60_000)} AND ${tsLit(m.ts + 15 * 60_000)}`, from: 'span' })}
            className="flex w-full items-start gap-3 border-b border-line/60 px-3 py-2 text-left hover:bg-surface-2"
          >
            <span className="num w-7 shrink-0 text-right font-semibold">{m.n}</span>
            <span className="flex w-36 shrink-0 items-center gap-1.5 truncate text-ink-2">
              <Badge name={m.sender} />
              <span className="truncate">{m.sender}</span>
            </span>
            <MessagePreview text={m.text} kind={m.kind} atts={m.atts} />
            <span className="shrink-0 text-[13px]">{[...new Set(m.emojis)].slice(0, 6).join('')}</span>
            <span className="num w-24 shrink-0 text-right text-[11px] text-ink-3">{fmtDate(m.ts)}</span>
          </button>
        ))}
        {q.data?.length === 0 && <div className="p-3 text-ink-3">No reactions in this selection.</div>}
      </div>
    </Panel>
  );
}

export function Reactions({ openPerson }: { openPerson: (name: string) => void }) {
  return (
    <div className="space-y-3 p-4">
      <KpiRow />
      <div className="grid grid-cols-1 gap-3 @5xl:grid-cols-[3fr_2fr]">
        <MessagesVsReactions openPerson={openPerson} />
        <ReceivedTotals openPerson={openPerson} />
      </div>
      <div className="grid grid-cols-1 gap-3 @5xl:grid-cols-[2fr_3fr]">
        <TopReactions />
        <ReactionByPerson />
      </div>
      <div className="grid grid-cols-1 gap-3 @4xl:grid-cols-2">
        <GenerousVsAppreciated openPerson={openPerson} />
        <RateByYear />
      </div>
      <MostReacted />
    </div>
  );
}
