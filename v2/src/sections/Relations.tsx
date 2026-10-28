// Relations: how people interact. A reply network, who → whom flows
// (replies, reactions, @mentions), how fast each person replies, and how
// turns are shared.
import { useMemo, useState } from 'react';
import { pairPeopleSql, useConversation } from '../app/ConversationProvider';
import { repliesCte, REPLY_WINDOWS, replyPairWhere, TURNS_CTE } from '../app/relations';
import { EChart } from '../charts/EChart';
import { personBoxplot, type Quantiles } from '../charts/shapes';
import { baseOption, esc, legend, tipRow, useChartTheme } from '../charts/theme';
import { lit } from '../db/duckdb';
import { useQuery } from '../db/useQuery';
import { fmtInt, fmtPct } from '../lib/format';
import { fmtDuration, MINUTE } from '../lib/time';
import { Panel, Segmented, Stat } from '../ui/primitives';
import { Badge } from '../ui/Badge';


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

// --- Flows ------------------------------------------------------------------------

type Flow = 'replies' | 'reactions' | 'mentions';
const FLOW_UNIT: Record<Flow, string> = { replies: 'replies', reactions: 'reactions', mentions: 'mentions' };

/**
 * Who → whom as a Sankey diagram: people on the left send replies, reactions
 * or @mentions to people on the right; band width = how many. Small flows are
 * dropped so the main ones stay readable.
 */
function FlowSankey() {
  const t = useChartTheme();
  const { conv, colorOf, inspect, filters, replyWindow } = useConversation();
  const [flow, setFlow] = useState<Flow>('replies');
  const everyone = conv.people.filter((p) => p.messages > 0).map((p) => p.name);
  const sql: Record<Flow, string> = {
    replies: `WITH ${repliesCte(replyWindow)} SELECT replier AS a, target AS b, count(*) AS n FROM replies WHERE ${pairPeopleSql(filters, 'replier', 'target')} GROUP BY 1, 2`,
    reactions: `SELECT actor AS a, receiver AS b, count(*) AS n FROM span_reactions WHERE actor <> receiver AND ${pairPeopleSql(filters, 'actor', 'receiver')} GROUP BY 1, 2`,
    mentions: `WITH p(name) AS (VALUES ${everyone.map((n) => `(${lit(n)})`).join(', ')}),
      m AS (SELECT sender, text FROM span WHERE text LIKE '%@%')
      SELECT m.sender AS a, p.name AS b, count(*) AS n FROM m JOIN p ON position('@' || p.name IN m.text) > 0
      WHERE m.sender <> p.name AND ${pairPeopleSql(filters, 'm.sender', 'p.name')} GROUP BY 1, 2`,
  };
  const q = useQuery<{ a: string; b: string; n: number }>(sql[flow]);

  const { option, height, kept, total } = useMemo(() => {
    const base = baseOption(t);
    const links = [...(q.data ?? [])].sort((x, y) => y.n - x.n);
    const total = links.reduce((s, l) => s + l.n, 0);
    // Keep flows covering 95% of the volume (max 90), plus each person's biggest one.
    const keep = new Set<string>();
    let acc = 0;
    for (const l of links) {
      if (acc / Math.max(1, total) >= 0.95 || keep.size >= 90) break;
      keep.add(`${l.a}\u0000${l.b}`);
      acc += l.n;
    }
    for (const who of new Set(links.map((l) => l.a))) {
      const top = links.find((l) => l.a === who);
      if (top) keep.add(`${top.a}\u0000${top.b}`);
    }
    const kept = links.filter((l) => keep.has(`${l.a}\u0000${l.b}`));
    const keptTotal = kept.reduce((s, l) => s + l.n, 0);
    const sent = new Map<string, number>(), got = new Map<string, number>();
    for (const l of links) {
      sent.set(l.a, (sent.get(l.a) ?? 0) + l.n);
      got.set(l.b, (got.get(l.b) ?? 0) + l.n);
    }
    const left = [...new Set(kept.map((l) => l.a))], right = [...new Set(kept.map((l) => l.b))];
    const unit = FLOW_UNIT[flow];
    return {
      kept,
      total,
      height: Math.max(320, Math.max(left.length, right.length) * 28 + 40),
      option: {
        ...base,
        tooltip: {
          ...base.tooltip,
          trigger: 'item',
          formatter: (p: { dataType: string; data: { source?: string; target?: string; value?: number; name?: string } }) => {
            if (p.dataType === 'edge') {
              const a = p.data.source!.slice(5), b = p.data.target!.slice(3);
              return `<div style="margin-bottom:4px;opacity:.7">${esc(a)} → ${esc(b)}</div>` +
                tipRow(colorOf(a), fmtInt(p.data.value!), `${unit} · ${fmtPct(p.data.value! / Math.max(1, sent.get(a) ?? 0), 0)} of ${esc(a.split(' ')[0])}’s`);
            }
            const name = p.data.name!.replace(/^(from|to):/, '');
            return `<div style="font-weight:600;margin-bottom:4px">${esc(name)}</div>` +
              tipRow(colorOf(name), fmtInt(sent.get(name) ?? 0), `${unit} given`) + tipRow(t.ink2, fmtInt(got.get(name) ?? 0), `${unit} received`);
          },
        },
        series: [{
          type: 'sankey',
          left: 130, right: 130, top: 10, bottom: 10,
          nodeWidth: 10, nodeGap: 8, layoutIterations: 32, draggable: false,
          emphasis: { focus: 'adjacency' },
          label: {
            color: t.ink2, fontSize: 11,
            // Tiny nodes stack into a few pixels; their labels would collide.
            formatter: (p: { name: string; value: number }) => (p.value < keptTotal * 0.012 ? '' : p.name.replace(/^(from|to):/, '')),
          },
          levels: [{ depth: 0, label: { position: 'left' } }, { depth: 1, label: { position: 'right' } }],
          lineStyle: { color: 'source', opacity: 0.35, curveness: 0.5 },
          data: [
            ...left.map((n) => ({ name: `from:${n}`, itemStyle: { color: colorOf(n), borderWidth: 0 } })),
            ...right.map((n) => ({ name: `to:${n}`, itemStyle: { color: colorOf(n), borderWidth: 0 } })),
          ],
          links: kept.map((l) => ({ source: `from:${l.a}`, target: `to:${l.b}`, value: l.n })),
        }],
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, flow, t, colorOf]);

  const shownShare = total ? kept.reduce((s, l) => s + l.n, 0) / total : 1;
  return (
    <Panel
      title="Who → whom"
      actions={
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-ink-3">{shownShare < 0.999 ? `biggest flows, ${fmtPct(shownShare, 0)} of all · ` : ''}click a band to read</span>
          <Segmented value={flow} options={[['replies', 'Replies'], ['reactions', 'Reactions'], ['mentions', '@mentions']] as [Flow, string][]} onChange={setFlow} />
        </div>
      }
      bodyClassName="p-2"
    >
      {q.data && !q.data.length && !q.loading ? (
        <div className="p-3 text-ink-3">No {FLOW_UNIT[flow]} between people in this selection.</div>
      ) : (
        <EChart
          option={option}
          height={height}
          dimmed={q.loading}
          on={{
            click: (p: { dataType: string; data: { source?: string; target?: string } }) => {
              if (p.dataType !== 'edge') return;
              const a = p.data.source!.slice(5), b = p.data.target!.slice(3);
              if (flow === 'replies') inspect({ title: `${a} ↔ ${b}`, where: replyPairWhere(replyWindow, a, b), from: 'span' });
              else if (flow === 'reactions') inspect({ title: `${a} reacting to ${b}`, where: `message_id IN (SELECT message_id FROM span_reactions WHERE actor = ${lit(a)} AND receiver = ${lit(b)})`, from: 'span' });
              else inspect({ title: `${a} mentioning ${b}`, where: `sender = ${lit(a)} AND position(${lit(`@${b}`)} IN text) > 0`, from: 'span' });
            },
          }}
        />
      )}
    </Panel>
  );
}

// --- Reply times -------------------------------------------------------------------

/** How fast each person replies, as a distribution (fastest median on top). */
function ReplySpeed() {
  const t = useChartTheme();
  const { replyWindow, colorOf, filters } = useConversation();
  const q = useQuery<{ s: string; n: number; p5: number; q1: number; med: number; q3: number; p95: number }>(`
    WITH ${repliesCte(replyWindow)}
    SELECT replier AS s, count(*) AS n,
           quantile_cont(lat_ms, 0.05) AS p5, quantile_cont(lat_ms, 0.25) AS q1, median(lat_ms) AS med,
           quantile_cont(lat_ms, 0.75) AS q3, quantile_cont(lat_ms, 0.95) AS p95
    FROM replies WHERE ${pairPeopleSql(filters, 'replier', 'replier')} GROUP BY 1 HAVING count(*) >= 10 ORDER BY med`);
  const { option, height } = useMemo(
    () => personBoxplot(t, {
      rows: (q.data ?? []).map((r) => ({ name: r.s, n: r.n, q: [r.p5, r.q1, r.med, r.q3, r.p95].map((v) => Math.max(1000, v)) as Quantiles })),
      colorOf, format: (v) => fmtDuration(v), unit: 'reply time', log: true, axisName: 'reply time →',
    }),
    [q.data, t, colorOf],
  );
  return (
    <Panel title="How fast people reply" actions={<span className="text-[11px] text-ink-3">box = middle half · line = median · whiskers 5–95% · log scale · 10+ replies</span>} bodyClassName="p-2">
      <EChart option={option} height={height} dimmed={q.loading} />
    </Panel>
  );
}

const LINES_SHOWN = 8;

function ReplyTimeByYear() {
  const t = useChartTheme();
  const { replyWindow, seriesNames, colorOf, filters } = useConversation();
  const q = useQuery<{ s: string; y: number; med: number; n: number }>(`
    WITH ${repliesCte(replyWindow)}
    SELECT replier AS s, year(ts) AS y, median(lat_ms) AS med, count(*) AS n
    FROM replies WHERE ${pairPeopleSql(filters, 'replier', 'replier')} GROUP BY 1, 2 HAVING count(*) >= 5`);
  const option = useMemo(() => {
    const base = baseOption(t);
    const data = q.data ?? [];
    const years = [...new Set(data.map((r) => r.y))].sort();
    const names = seriesNames.filter((s) => data.some((r) => r.s === s));
    // Everyone is in the legend; the most active start visible so the lines stay readable.
    const volume = new Map<string, number>();
    for (const r of data) volume.set(r.s, (volume.get(r.s) ?? 0) + r.n);
    const visible = new Set([...names].sort((a, b) => (volume.get(b) ?? 0) - (volume.get(a) ?? 0)).slice(0, LINES_SHOWN));
    return {
      ...base,
      grid: { ...base.grid, top: 36 },
      legend: { ...legend(t, names, 'line'), selected: Object.fromEntries(names.map((n) => [n, visible.has(n)])) },
      tooltip: {
        ...base.tooltip, trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: t.axis } },
        formatter: (ps: { seriesName: string; value: number | null; color: string; dataIndex: number }[]) =>
          `<div style="margin-bottom:4px;opacity:.7">${years[ps[0].dataIndex]} · median reply time</div>` +
          ps.filter((p) => p.value != null).sort((a, b) => a.value! - b.value!).map((p) => tipRow(p.color, fmtDuration(p.value! * MINUTE), p.seriesName)).join(''),
      },
      xAxis: { type: 'category', data: years.map(String), boundaryGap: false, ...base.axisCommon, splitLine: { show: false } },
      yAxis: { type: 'log', logBase: 10, ...base.axisCommon, axisLine: { show: false }, axisLabel: { ...base.axisCommon.axisLabel, formatter: (v: number) => fmtDuration(v * MINUTE) } },
      series: names.map((s) => ({
        name: s, type: 'line', symbol: 'circle', symbolSize: 7, connectNulls: false,
        lineStyle: { width: 2, color: colorOf(s) }, itemStyle: { color: colorOf(s), borderColor: t.surface, borderWidth: 2 },
        emphasis: { focus: 'series' },
        data: years.map((y) => { const r = data.find((d) => d.s === s && d.y === y); return r ? Math.max(r.med / MINUTE, 0.05) : null; }),
      })),
    };
  }, [q.data, seriesNames, colorOf, t]);
  return (
    <Panel title="Median reply time by year" actions={<span className="text-[11px] text-ink-3">log scale · click names to show or hide people</span>} bodyClassName="p-2">
      <EChart option={option} height={320} dimmed={q.loading} />
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
      <div className={`grid grid-cols-1 gap-3 ${active > 2 ? '@5xl:grid-cols-2' : ''}`}>
        {active > 2 && <ReplyNetwork openPerson={openPerson} />}
        <FlowSankey />
      </div>
      <div className="grid grid-cols-1 gap-3 @4xl:grid-cols-2">
        <ReplySpeed />
        <ReplyTimeByYear />
      </div>
      <TurnTable openPerson={openPerson} />
    </div>
  );
}
