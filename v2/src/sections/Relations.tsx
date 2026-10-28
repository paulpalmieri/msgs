// Relations: how people interact. Who replies to whom and how fast,
// who reacts to whom, who mentions whom, and how turns are shared.
import { useMemo, useState } from 'react';
import { pairPeopleSql, useConversation } from '../app/ConversationProvider';
import { matrixPeople, repliesCte, REPLY_WINDOWS, replyPairWhere, TURNS_CTE } from '../app/relations';
import { EChart } from '../charts/EChart';
import { gridHeatmap, personHeatmap, quantile, rowHeight } from '../charts/heatmap';
import { baseOption, esc, tipRow, useChartTheme } from '../charts/theme';
import { lit } from '../db/duckdb';
import { useQuery } from '../db/useQuery';
import { fmtInt, fmtPct } from '../lib/format';
import { fmtDuration, MINUTE } from '../lib/time';
import { Panel, Segmented, Stat } from '../ui/primitives';
import { Badge } from '../ui/Badge';

type Cell = [number, number, number];

export function ReplyWindowControl() {
  const { replyWindow, setReplyWindow } = useConversation();
  return (
    <div className="flex items-center gap-3">
      <span className="text-ink-3">A message is a reply when it follows someone else’s within</span>
      <Segmented value={String(replyWindow)} options={REPLY_WINDOWS as [string, string][]} onChange={(v) => setReplyWindow(Number(v))} />
    </div>
  );
}

// --- KPIs ---------------------------------------------------------------------

function KpiRow() {
  const { replyWindow, filters } = useConversation();
  const w = pairPeopleSql(filters, 'replier', 'target');
  const k = useQuery<{ replies: number; med: number | null; pairs: number }>(`
    WITH ${repliesCte(replyWindow)}
    SELECT count(*) AS replies, median(lat_ms) AS med, count(DISTINCT least(replier, target) || '↔' || greatest(replier, target)) AS pairs
    FROM replies WHERE ${w}`).data?.[0];
  const fastest = useQuery<{ replier: string; med: number; n: number }>(`
    WITH ${repliesCte(replyWindow)}
    SELECT replier, median(lat_ms) AS med, count(*) AS n FROM replies WHERE ${w}
    GROUP BY 1 HAVING count(*) >= 20 ORDER BY med LIMIT 1`).data?.[0];
  const pair = useQuery<{ a: string; b: string; n: number }>(`
    WITH ${repliesCte(replyWindow)}
    SELECT least(replier, target) AS a, greatest(replier, target) AS b, count(*) AS n FROM replies WHERE ${w}
    GROUP BY 1, 2 ORDER BY n DESC LIMIT 1`).data?.[0];
  const target = useQuery<{ target: string; n: number }>(`
    WITH ${repliesCte(replyWindow)}
    SELECT target, count(*) AS n FROM replies WHERE ${w} GROUP BY 1 ORDER BY n DESC LIMIT 1`).data?.[0];
  return (
    <div className="grid grid-cols-2 gap-3 @5xl:grid-cols-5">
      <Stat label="Replies" value={fmtInt(k?.replies)} sub={k ? `across ${fmtInt(k.pairs)} pairs of people` : undefined} />
      <Stat label="Typical reply time" value={fmtDuration(k?.med)} sub="median, within the window" />
      <Stat label="Fastest replier" value={fastest?.replier ?? '–'} sub={fastest ? `${fmtDuration(fastest.med)} median · ${fmtInt(fastest.n)} replies` : 'needs 20+ replies'} />
      <Stat label="Most replied to" value={target?.target ?? '–'} sub={target ? `${fmtInt(target.n)} replies received` : undefined} />
      <Stat label="Strongest pair" value={pair ? `${pair.a.split(' ')[0]} ↔ ${pair.b.split(' ')[0]}` : '–'} sub={pair ? `${fmtInt(pair.n)} replies between them` : undefined} />
    </div>
  );
}

// --- Network ------------------------------------------------------------------

function ReplyNetwork({ openPerson }: { openPerson: (name: string) => void }) {
  const t = useChartTheme();
  const { replyWindow, colorOf, inspect, filters } = useConversation();
  const nodesQ = useQuery<{ sender: string; n: number }>(`SELECT sender, count(*) AS n FROM span GROUP BY 1`);
  const edgesQ = useQuery<{ replier: string; target: string; n: number }>(`
    WITH ${repliesCte(replyWindow)} SELECT replier, target, count(*) AS n FROM replies GROUP BY 1, 2`);

  const { option, edges } = useMemo(() => {
    const nodes = nodesQ.data ?? [];
    const directed = new Map((edgesQ.data ?? []).map((e) => [`${e.replier}\u0000${e.target}`, e.n]));
    const pairs = new Map<string, { a: string; b: string; n: number }>();
    for (const e of edgesQ.data ?? []) {
      const [a, b] = [e.replier, e.target].sort();
      const key = `${a}\u0000${b}`;
      const p = pairs.get(key) ?? { a, b, n: 0 };
      p.n += e.n;
      pairs.set(key, p);
    }
    const maxEdge = Math.max(1, ...[...pairs.values()].map((p) => p.n));
    // Keep the readable backbone: strong links, plus each person's two strongest.
    const strongest = new Map<string, number[]>();
    for (const p of pairs.values()) for (const who of [p.a, p.b]) strongest.set(who, [...(strongest.get(who) ?? []), p.n]);
    const floor = new Map([...strongest].map(([who, ns]) => [who, ns.sort((x, y) => y - x)[Math.min(1, ns.length - 1)]]));
    const edges = [...pairs.values()].filter((p) => p.n >= 2 && (p.n >= maxEdge * 0.12 || p.n >= floor.get(p.a)! || p.n >= floor.get(p.b)!));
    const maxNode = Math.max(1, ...nodes.map((n) => n.n));
    const focus = new Set(filters.people);
    const base = baseOption(t);
    return {
      edges,
      option: {
        ...base,
        tooltip: {
          ...base.tooltip,
          trigger: 'item',
          formatter: (p: { dataType: string; data: { name?: string; value?: number; source?: string; target?: string } }) => {
            if (p.dataType === 'node') return `<div style="font-weight:600;margin-bottom:4px">${esc(p.data.name)}</div>` + tipRow(colorOf(p.data.name!), fmtInt(p.data.value!), 'messages');
            const { source: a, target: b } = p.data as { source: string; target: string };
            return `<div style="margin-bottom:4px;opacity:.7">${esc(a)} ↔ ${esc(b)}</div>` +
              tipRow(colorOf(a), fmtInt(directed.get(`${a}\u0000${b}`) ?? 0), `${a.split(' ')[0]} → ${b.split(' ')[0]}`) +
              tipRow(colorOf(b), fmtInt(directed.get(`${b}\u0000${a}`) ?? 0), `${b.split(' ')[0]} → ${a.split(' ')[0]}`);
          },
        },
        series: [{
          type: 'graph',
          layout: 'force',
          roam: true,
          draggable: true,
          force: { repulsion: 320, gravity: 0.06, edgeLength: [50, 240], friction: 0.2 },
          emphasis: { focus: 'adjacency', lineStyle: { opacity: 0.9 } },
          label: { show: true, position: 'right', color: t.ink2, fontSize: 11, formatter: (p: { name: string }) => p.name.split(' ')[0] },
          data: nodes.map((n) => ({
            name: n.sender,
            value: n.n,
            symbolSize: 10 + 38 * Math.sqrt(n.n / maxNode),
            itemStyle: { color: colorOf(n.sender), borderColor: t.surface, borderWidth: 2, opacity: focus.size && !focus.has(n.sender) ? 0.35 : 1 },
          })),
          links: edges.map((e) => ({
            source: e.a,
            target: e.b,
            value: e.n,
            lineStyle: { width: 0.75 + 7 * Math.pow(e.n / maxEdge, 0.7), color: t.muted, opacity: 0.45, curveness: 0.08 },
          })),
        }],
      },
    };
  }, [nodesQ.data, edgesQ.data, t, colorOf, filters.people]);

  return (
    <Panel
      title="Reply network"
      actions={<span className="text-[11px] text-ink-3">strongest links · click a person or a link</span>}
      bodyClassName="p-2"
    >
      <EChart
        option={option}
        height={460}
        dimmed={edgesQ.loading}
        on={{
          click: (p: { dataType: string; data: { name?: string; source?: string; target?: string } }) => {
            if (p.dataType === 'node') openPerson(p.data.name!);
            else if (p.data.source && p.data.target) {
              inspect({ title: `${p.data.source} ↔ ${p.data.target}`, where: replyPairWhere(replyWindow, p.data.source, p.data.target), from: 'span' });
            }
          },
        }}
      />
      {!edges.length && !edgesQ.loading && <div className="p-3 text-ink-3">No replies in this window.</div>}
    </Panel>
  );
}

// --- Matrices -------------------------------------------------------------------

function MatrixPanel({ title, hint, height, option, loading, onCell, controls }: {
  title: string; hint: string; height: number; option: Record<string, unknown>; loading: boolean; onCell: (x: number, y: number) => void; controls?: React.ReactNode;
}) {
  return (
    <Panel title={title} actions={<div className="flex items-center gap-3"><span className="text-[11px] text-ink-3">{hint}</span>{controls}</div>} bodyClassName="p-2">
      <EChart option={option} height={height} dimmed={loading} on={{ click: (p: { value: Cell }) => onCell(p.value[0], p.value[1]) }} />
    </Panel>
  );
}

function matrixHeight(n: number) {
  return Math.max(220, n * rowHeight(n) + 130);
}

function ReplyMatrix() {
  const t = useChartTheme();
  const { conv, colorOf, replyWindow, inspect, filters } = useConversation();
  const [mode, setMode] = useState<'count' | 'share'>('count');
  const { names, fold } = matrixPeople(conv);
  const q = useQuery<{ a: string; b: string; n: number }>(`
    WITH ${repliesCte(replyWindow)}
    SELECT ${fold('replier')} AS a, ${fold('target')} AS b, count(*) AS n FROM replies
    WHERE ${pairPeopleSql(filters, 'replier', 'target')} GROUP BY 1, 2`);
  const rows = [...names].reverse();
  const option = useMemo(() => {
    const rowTotal = new Map<string, number>();
    for (const r of q.data ?? []) rowTotal.set(r.a, (rowTotal.get(r.a) ?? 0) + r.n);
    const cells = (q.data ?? [])
      .map((r) => [names.indexOf(r.b), rows.indexOf(r.a), mode === 'count' ? r.n : (r.n / rowTotal.get(r.a)!) * 100] as Cell)
      .filter((c) => c[0] >= 0 && c[1] >= 0);
    return gridHeatmap(t, {
      x: names, y: rows, cells, yName: 'who replies ↓', xRotate: names.length > 4 ? 35 : 0, yColors: rows.map(colorOf),
      max: quantile(cells.map((c) => c[2]), 0.98),
      title: (x, y) => `${y} → ${x}`,
      value: (v) => (mode === 'count' ? `${fmtInt(v)} replies` : `${v.toFixed(0)}% of their replies`),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, mode, t, names.join(), colorOf]);
  return (
    <MatrixPanel
      title="Who replies to whom"
      hint="row replies to column · click a cell to read"
      height={matrixHeight(names.length)}
      option={option}
      loading={q.loading}
      controls={<Segmented value={mode} options={[['count', 'Count'], ['share', 'Row %']]} onChange={setMode} />}
      onCell={(x, y) => {
        const [a, b] = [rows[y], names[x]];
        inspect({ title: `${a} ↔ ${b}`, where: replyPairWhere(replyWindow, a, b), from: 'span' });
      }}
    />
  );
}

function ReactionMatrix() {
  const t = useChartTheme();
  const { conv, colorOf, inspect, filters } = useConversation();
  const [mode, setMode] = useState<'count' | 'rate'>('count');
  const { names, fold } = matrixPeople(conv);
  const q = useQuery<{ a: string; b: string; n: number; base: number }>(`
    WITH msgs AS (SELECT ${fold('sender')} AS b, count(*) AS base FROM span GROUP BY 1)
    SELECT ${fold('actor')} AS a, ${fold('receiver')} AS b, count(*) AS n, any_value(msgs.base) AS base
    FROM span_reactions JOIN msgs ON msgs.b = ${fold('receiver')}
    WHERE ${pairPeopleSql(filters, 'actor', 'receiver')} GROUP BY 1, 2`);
  const rows = [...names].reverse();
  const option = useMemo(() => {
    const cells = (q.data ?? [])
      .map((r) => [names.indexOf(r.b), rows.indexOf(r.a), mode === 'count' ? r.n : (r.n / r.base) * 100] as Cell)
      .filter((c) => c[0] >= 0 && c[1] >= 0);
    return gridHeatmap(t, {
      x: names, y: rows, cells, yName: 'who reacts ↓', xRotate: names.length > 4 ? 35 : 0, yColors: rows.map(colorOf),
      max: quantile(cells.map((c) => c[2]), 0.98),
      title: (x, y) => `${y} → ${x}`,
      value: (v) => (mode === 'count' ? `${fmtInt(v)} reactions` : `${v.toFixed(1)} per 100 of their messages`),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, mode, t, names.join(), colorOf]);
  return (
    <MatrixPanel
      title="Who reacts to whom"
      hint="row reacts to column · click to read"
      height={matrixHeight(names.length)}
      option={option}
      loading={q.loading}
      controls={<Segmented value={mode} options={[['count', 'Count'], ['rate', 'Per 100 msgs']]} onChange={setMode} />}
      onCell={(x, y) => {
        const [a, b] = [rows[y], names[x]];
        inspect({ title: `${a} reacting to ${b}`, where: `message_id IN (SELECT message_id FROM span_reactions WHERE actor = ${lit(a)} AND receiver = ${lit(b)})`, from: 'span' });
      }}
    />
  );
}

function MentionMatrix() {
  const t = useChartTheme();
  const { conv, colorOf, inspect, filters } = useConversation();
  const { names, fold } = matrixPeople(conv);
  const all = conv.people.filter((p) => p.messages > 0).map((p) => p.name);
  const q = useQuery<{ a: string; b: string; n: number }>(`
    WITH p(name) AS (VALUES ${all.map((n) => `(${lit(n)})`).join(', ')}),
         m AS (SELECT sender, text FROM span WHERE text LIKE '%@%')
    SELECT ${fold('m.sender')} AS a, ${fold('p.name')} AS b, count(*) AS n
    FROM m JOIN p ON position('@' || p.name IN m.text) > 0
    WHERE ${pairPeopleSql(filters, 'm.sender', 'p.name')} GROUP BY 1, 2`);
  const rows = [...names].reverse();
  const option = useMemo(() => {
    const cells = (q.data ?? []).map((r) => [names.indexOf(r.b), rows.indexOf(r.a), r.n] as Cell).filter((c) => c[0] >= 0 && c[1] >= 0);
    return gridHeatmap(t, {
      x: names, y: rows, cells, yName: 'who mentions ↓', xRotate: names.length > 4 ? 35 : 0, yColors: rows.map(colorOf),
      max: quantile(cells.map((c) => c[2]), 0.98),
      title: (x, y) => `${y} mentions ${x}`,
      value: (v) => `${fmtInt(v)} mentions`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, t, names.join(), colorOf]);
  if (q.data && !q.data.length) return null;
  return (
    <MatrixPanel
      title="Who mentions whom (@name)"
      hint="row mentions column · click to read"
      height={matrixHeight(names.length)}
      option={option}
      loading={q.loading}
      onCell={(x, y) => {
        const [a, b] = [rows[y], names[x]];
        inspect({ title: `${a} mentioning ${b}`, where: `sender = ${lit(a)} AND position(${lit(`@${b}`)} IN text) > 0`, from: 'span' });
      }}
    />
  );
}

// --- Reply times -------------------------------------------------------------------

const LAT_BINS: [string, number][] = [
  ['< 1 min', 1], ['1–5 min', 5], ['5–15 min', 15], ['15–60 min', 60], ['1–3 h', 180], ['3–12 h', 720], ['12–24 h', 1440],
];

function ReplyTimeDistribution() {
  const t = useChartTheme();
  const { replyWindow, seriesNames, colorOf, filters } = useConversation();
  const bins = LAT_BINS.filter((_, i) => i === 0 || LAT_BINS[i - 1][1] < replyWindow).map(([l, max]) => [l, Math.min(max, replyWindow)] as [string, number]);
  const q = useQuery<{ s: string; b: number; n: number }>(`
    WITH ${repliesCte(replyWindow)}
    SELECT replier AS s,
           CASE ${bins.map(([, max], i) => `WHEN lat_ms < ${max * MINUTE} THEN ${i}`).join(' ')} ELSE ${bins.length - 1} END AS b,
           count(*) AS n
    FROM replies WHERE ${pairPeopleSql(filters, 'replier', 'replier')} GROUP BY 1, 2`);
  const { option, height } = useMemo(() => {
    const values = new Map<string, number[]>();
    for (const r of q.data ?? []) {
      let arr = values.get(r.s);
      if (!arr) values.set(r.s, (arr = new Array(bins.length).fill(0)));
      arr[r.b] += r.n;
    }
    return personHeatmap(t, {
      people: seriesNames, colorOf, x: bins.map((b) => b[0]), values, rowShare: true,
      title: (x, p) => `${p} replied in ${x}`,
      value: (v) => `${v.toFixed(0)}% of their replies`,
      legend: ['more', 'less'],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, seriesNames, colorOf, t, replyWindow]);
  return (
    <Panel title="How fast people reply" actions={<span className="text-[11px] text-ink-3">each row is one person’s replies</span>} bodyClassName="p-2">
      <EChart option={option} height={height} dimmed={q.loading} />
    </Panel>
  );
}

function ReplyTimeByYear() {
  const t = useChartTheme();
  const { replyWindow, seriesNames, colorOf, filters } = useConversation();
  const q = useQuery<{ s: string; y: number; med: number; n: number }>(`
    WITH ${repliesCte(replyWindow)}
    SELECT replier AS s, year(ts) AS y, median(lat_ms) AS med, count(*) AS n
    FROM replies WHERE ${pairPeopleSql(filters, 'replier', 'replier')} GROUP BY 1, 2 HAVING count(*) >= 5`);
  const { option, height } = useMemo(() => {
    const data = q.data ?? [];
    const years = [...new Set(data.map((r) => r.y))].sort();
    const values = new Map<string, number[]>();
    for (const r of data) {
      let arr = values.get(r.s);
      if (!arr) values.set(r.s, (arr = new Array(years.length).fill(null)));
      arr[years.indexOf(r.y)] = r.med;
    }
    // Colour on a log scale, slowest = darkest, so a few very slow years don't wash out the rest.
    return personHeatmap(t, {
      people: seriesNames, colorOf, x: years.map(String), values,
      title: (x, p) => `${p} · ${x} · median reply`,
      value: (v) => fmtDuration(v),
      scale: (v) => Math.log10(Math.max(1000, v)),
      legend: ['slower', 'faster'],
    });
  }, [q.data, seriesNames, colorOf, t]);
  return (
    <Panel title="Median reply time by year" actions={<span className="text-[11px] text-ink-3">darker = slower · years with 5+ replies</span>} bodyClassName="p-2">
      <EChart option={option} height={height} dimmed={q.loading} />
    </Panel>
  );
}

// --- Turn-taking table ------------------------------------------------------------------

type TurnRow = {
  sender: string; turns: number; msgs: number; multi: number; longest: number;
  sent: number | null; received: number | null; med: number | null; p90: number | null;
};

function TurnTable({ openPerson }: { openPerson: (name: string) => void }) {
  const { replyWindow, filters } = useConversation();
  const q = useQuery<TurnRow>(`
    WITH ${TURNS_CTE}, ${repliesCte(replyWindow)},
    t AS (SELECT sender, count(*) AS turns, sum(n) AS msgs, count(*) FILTER (n >= 2) AS multi, max(n) AS longest FROM turns GROUP BY 1),
    rs AS (SELECT replier AS sender, count(*) AS sent, median(lat_ms) AS med, quantile_cont(lat_ms, 0.9) AS p90 FROM replies GROUP BY 1),
    rr AS (SELECT target AS sender, count(*) AS received FROM replies GROUP BY 1)
    SELECT t.*, rs.sent, rs.med, rs.p90, rr.received
    FROM t LEFT JOIN rs USING (sender) LEFT JOIN rr USING (sender)
    WHERE ${pairPeopleSql(filters, 't.sender', 't.sender')}
    ORDER BY msgs DESC`);
  const th = 'whitespace-nowrap border-b border-line px-3 py-1.5 text-right font-medium';
  const td = 'num border-b border-line/60 px-3 text-right';
  return (
    <Panel title="Turn-taking" actions={<span className="text-[11px] text-ink-3">a turn is a run of messages by one person · click a row for their profile</span>}>
      <div className={`max-h-[440px] overflow-auto ${q.loading ? 'opacity-50' : ''}`}>
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-surface text-ink-3">
            <tr>
              <th className={`${th} text-left`}>Person</th>
              <th className={th}>Turns</th>
              <th className={th}>Messages per turn</th>
              <th className={th} title="Turns where they sent two or more messages in a row">Double-texting</th>
              <th className={th}>Longest run</th>
              <th className={th}>Replies sent</th>
              <th className={th}>Replies received</th>
              <th className={th}>Median reply</th>
              <th className={th} title="90% of their replies come faster than this">90th pct reply</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.map((r) => (
              <tr key={r.sender} className="cursor-pointer hover:bg-surface-2" onClick={() => openPerson(r.sender)}>
                <td className="max-w-56 truncate border-b border-line/60 px-3 py-1">
                  <Badge name={r.sender} className="mr-2 align-middle" />
                  {r.sender}
                </td>
                <td className={td}>{fmtInt(r.turns)}</td>
                <td className={td}>{(r.msgs / r.turns).toFixed(2)}</td>
                <td className={td}>{fmtPct(r.multi / r.turns, 0)}</td>
                <td className={td}>{fmtInt(r.longest)}</td>
                <td className={td}>{fmtInt(r.sent ?? 0)}</td>
                <td className={td}>{fmtInt(r.received ?? 0)}</td>
                <td className={td}>{fmtDuration(r.med)}</td>
                <td className={td}>{fmtDuration(r.p90)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function Relations({ openPerson }: { openPerson: (name: string) => void }) {
  const { conv } = useConversation();
  const active = conv.people.filter((p) => p.messages > 0).length;
  return (
    <div className="space-y-3 p-4">
      <ReplyWindowControl />
      <KpiRow />
      {active > 2 ? (
        <div className="grid grid-cols-1 gap-3 @5xl:grid-cols-2">
          <ReplyNetwork openPerson={openPerson} />
          <ReplyMatrix />
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 @4xl:grid-cols-2">
        <ReplyTimeDistribution />
        <ReplyTimeByYear />
      </div>
      <TurnTable openPerson={openPerson} />
      <div className="grid grid-cols-1 gap-3 @5xl:grid-cols-2">
        <ReactionMatrix />
        <MentionMatrix />
      </div>
    </div>
  );
}
