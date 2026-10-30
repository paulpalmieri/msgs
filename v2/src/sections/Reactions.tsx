// Reactions: what people react with, to whom, and which messages landed.
// Reads `span` so the people filter keeps reactions where either side
// (reactor or author) is selected.
import { useMemo, useState } from 'react';
import { pairPeopleSql, useConversation } from '../app/ConversationProvider';
import { EChart } from '../charts/EChart';
import { gridHeatmap, quantile, rowHeight } from '../charts/heatmap';
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

const PRINT_EMOJI = 6;

/**
 * Each person's reaction fingerprint: the share of their reactions going to
 * each of the group's most used emoji (plus "other"), as one 100% bar.
 */
function ReactionFingerprints() {
  const t = useChartTheme();
  const where = useWhere();
  const { seriesNames, colorOf, inspect } = useConversation();
  const top = useQuery<{ reaction: string }>(`SELECT reaction FROM span_reactions WHERE ${where} GROUP BY 1 ORDER BY count(*) DESC LIMIT ${PRINT_EMOJI}`).data ?? [];
  const emojis = top.map((r) => r.reaction);
  const q = useQuery<{ s: string; reaction: string; n: number }>(`SELECT actor AS s, reaction, count(*) AS n FROM span_reactions WHERE ${where} GROUP BY 1, 2`);
  const { option, rows } = useMemo(() => {
    const base = baseOption(t);
    const by = new Map<string, Map<string, number>>();
    for (const r of q.data ?? []) {
      if (!by.has(r.s)) by.set(r.s, new Map());
      by.get(r.s)!.set(r.reaction, r.n);
    }
    const rows = seriesNames.filter((n) => [...(by.get(n)?.values() ?? [])].reduce((a, b) => a + b, 0) >= 10).reverse();
    const cats = [...emojis, 'other'];
    // Emoji aren't people: shades of one hue, most used darkest, so the person colours stay meaningful.
    const ramp = t.dark ? [t.seq[7], t.seq[6], t.seq[5], t.seq[4], t.seq[3], t.seq[2], t.grid] : [t.seq[7], t.seq[6], t.seq[5], t.seq[4], t.seq[3], t.seq[2], t.grid];
    const share = (name: string, cat: string) => {
      const m = by.get(name)!;
      const tot = [...m.values()].reduce((a, b) => a + b, 0);
      const v = cat === 'other' ? [...m].filter(([e]) => !emojis.includes(e)).reduce((a, [, n]) => a + n, 0) : m.get(cat) ?? 0;
      return { pct: (v / tot) * 100, n: v, tot };
    };
    return {
      rows,
      option: {
        ...base,
        grid: { ...base.grid, left: 8, right: 16, top: 30, bottom: 8 },
        legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, icon: 'rect', textStyle: { color: t.ink2, fontSize: 13 }, data: cats },
        tooltip: {
          ...base.tooltip, trigger: 'item',
          formatter: (p: { seriesName: string; dataIndex: number }) => {
            const sh = share(rows[p.dataIndex], p.seriesName);
            return `<div style="font-weight:600;margin-bottom:4px">${esc(rows[p.dataIndex])}</div>` + tipRow(t.series[0], `${sh.pct.toFixed(0)}%`, `${p.seriesName} · ${fmtInt(sh.n)} of ${fmtInt(sh.tot)} reactions`);
          },
        },
        xAxis: { type: 'value', max: 100, show: false },
        yAxis: {
          type: 'category', data: rows, ...base.axisCommon, axisLine: { show: false },
          axisLabel: {
            color: t.ink2, fontSize: rows.length > 30 ? 10 : 11, width: 130, overflow: 'truncate',
            formatter: (v: string, i: number) => `{d${i}|}  ${v}`,
            rich: Object.fromEntries(rows.map((r, i) => [`d${i}`, { backgroundColor: colorOf(r), width: 8, height: 8, borderRadius: 4 }])),
          },
        },
        series: cats.map((c, ci) => ({
          name: c, type: 'bar', stack: 'fp', barMaxWidth: 18,
          itemStyle: { color: ramp[ci], borderColor: t.surface, borderWidth: 1 },
          label: { show: true, color: ci < 3 ? '#fff' : t.ink, fontSize: 12, formatter: (p: { value: number }) => (p.value >= 9 && c !== 'other' ? c : '') },
          data: rows.map((r) => share(r, c).pct),
        })),
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, emojis.join(), seriesNames, colorOf, t]);
  return (
    <Panel title="Reaction fingerprints" actions={<span className="text-[11px] text-ink-3">how each person reacts · 10+ reactions given · click to read</span>} bodyClassName="p-2">
      <EChart
        option={option}
        height={Math.max(220, rows.length * (rows.length > 30 ? 16 : 24) + 50)}
        dimmed={q.loading}
        on={{
          click: (p: { seriesName: string; dataIndex: number }) => {
            const who = rows[p.dataIndex];
            const cond = p.seriesName === 'other' ? `reaction NOT IN (${emojis.map(lit).join(', ')})` : `reaction = ${lit(p.seriesName)}`;
            inspect({ title: `${who} reacting ${p.seriesName}`, where: `message_id IN (SELECT message_id FROM span_reactions WHERE actor = ${lit(who)} AND ${cond})`, from: 'span' });
          },
        }}
      />
    </Panel>
  );
}

// --- Who reacts to whom -------------------------------------------------------------

/** Reactions between two different people, by reactor, emoji and author. */
function usePairReactions() {
  const where = useWhere();
  return useQuery<{ a: string; e: string; b: string; n: number }>(`
    SELECT actor AS a, reaction AS e, receiver AS b, count(*) AS n FROM span_reactions
    WHERE actor <> receiver AND ${where} GROUP BY 1, 2, 3`);
}

const REST = 'Everyone else';
const FLOW_PEOPLE = 12;
const FLOW_EMOJI = 6;
const strip = (node: string) => node.replace(/^(from|emo|to):/, '');
const first = (name: string) => name.split(' ')[0];

/** SQL condition for one Sankey node: a name, or everything not shown on its own. */
function nodeCond(col: string, value: string, shown: string[], rest: string): string {
  return value === rest ? (shown.length ? `${col} NOT IN (${shown.map(lit).join(', ')})` : 'TRUE') : `${col} = ${lit(value)}`;
}

type FlowMode = 'people' | 'emoji';

/**
 * Who reacts to whom as a Sankey: reactors on the left, the people they react
 * to on the right, optionally through the emoji they use in between.
 */
function ReactionFlow() {
  const t = useChartTheme();
  const { colorOf, inspect } = useConversation();
  const [mode, setMode] = useState<FlowMode>('people');
  const q = usePairReactions();

  const flow = useMemo(() => {
    const rows = q.data ?? [];
    const total = rows.reduce((s, r) => s + r.n, 0);
    const sum = (key: (r: (typeof rows)[number]) => string) => {
      const m = new Map<string, number>();
      for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + r.n);
      return [...m].sort((x, y) => y[1] - x[1]);
    };
    const given = sum((r) => r.a), received = sum((r) => r.b), byEmoji = sum((r) => r.e);
    let links: { source: string; target: string; value: number }[];
    let reactors: string[] = [], authors: string[] = [], emojis: string[] = [];
    if (mode === 'people') {
      // Keep flows covering 95% of the volume (max 90), plus each reactor's biggest one.
      const pairs = sum((r) => `${r.a}\u0000${r.b}`);
      const keep = new Set<string>();
      let acc = 0;
      for (const [k, n] of pairs) {
        if (acc / Math.max(1, total) >= 0.95 || keep.size >= 90) break;
        keep.add(k);
        acc += n;
      }
      for (const [who] of given) {
        const top = pairs.find(([k]) => k.startsWith(`${who}\u0000`));
        if (top) keep.add(top[0]);
      }
      links = pairs.filter(([k]) => keep.has(k)).map(([k, n]) => {
        const [a, b] = k.split('\u0000');
        return { source: `from:${a}`, target: `to:${b}`, value: n };
      });
    } else {
      // Three columns get crowded fast: the most active people and emoji, the rest folded together.
      reactors = given.slice(0, FLOW_PEOPLE).map(([n]) => n);
      authors = received.slice(0, FLOW_PEOPLE).map(([n]) => n);
      emojis = byEmoji.slice(0, FLOW_EMOJI).map(([e]) => e);
      const fold = (v: string, shown: string[], rest: string) => (shown.includes(v) ? v : rest);
      const acc = new Map<string, number>();
      for (const r of rows) {
        const a = `from:${fold(r.a, reactors, REST)}`, e = `emo:${fold(r.e, emojis, 'other')}`, b = `to:${fold(r.b, authors, REST)}`;
        acc.set(`${a}\u0000${e}`, (acc.get(`${a}\u0000${e}`) ?? 0) + r.n);
        acc.set(`${e}\u0000${b}`, (acc.get(`${e}\u0000${b}`) ?? 0) + r.n);
      }
      links = [...acc].map(([k, value]) => { const [source, target] = k.split('\u0000'); return { source, target, value }; });
    }
    const nodes = [...new Set(links.flatMap((l) => [l.source, l.target]))];
    const shown = links.filter((l) => l.source.startsWith('from:')).reduce((s, l) => s + l.value, 0);
    return { links, nodes, total, shown, given: new Map(given), received: new Map(received), reactors, authors, emojis };
  }, [q.data, mode]);

  const option = useMemo(() => {
    const base = baseOption(t);
    const nodeColor = (node: string) => (node.startsWith('emo:') ? t.seq[5] : strip(node) === REST ? t.other : colorOf(strip(node)));
    return {
      ...base,
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (p: { dataType: string; value: number; data: { source?: string; target?: string; name?: string } }) => {
          if (p.dataType === 'edge') {
            const a = strip(p.data.source!), b = strip(p.data.target!);
            const from = p.data.source!.startsWith('from:') ? a : null;
            const of = from && from !== REST ? ` · ${fmtPct(p.value / Math.max(1, flow.given.get(from) ?? 0), 0)} of ${esc(first(from))}’s` : '';
            return `<div style="margin-bottom:4px;opacity:.7">${esc(a)} → ${esc(b)}</div>` + tipRow(nodeColor(p.data.source!), fmtInt(p.value), `reactions${of}`);
          }
          const node = p.data.name!, name = strip(node);
          if (node.startsWith('emo:') || name === REST) return `<div style="font-weight:600;margin-bottom:4px">${esc(name)}</div>` + tipRow(nodeColor(node), fmtInt(p.value), 'reactions');
          return `<div style="font-weight:600;margin-bottom:4px">${esc(name)}</div>` +
            tipRow(colorOf(name), fmtInt(flow.given.get(name) ?? 0), 'reactions given') + tipRow(t.ink2, fmtInt(flow.received.get(name) ?? 0), 'reactions received');
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
          formatter: (p: { name: string; value: number }) => (p.name.startsWith('emo:') || p.value >= flow.shown * 0.012 ? strip(p.name) : ''),
        },
        levels: mode === 'people'
          ? [{ depth: 0, label: { position: 'left' } }, { depth: 1, label: { position: 'right' } }]
          : [{ depth: 0, label: { position: 'left' } }, { depth: 1, label: { position: 'right', fontSize: 16, color: t.ink } }, { depth: 2, label: { position: 'right' } }],
        lineStyle: { color: 'source', opacity: 0.35, curveness: 0.5 },
        data: flow.nodes.map((n) => ({
          name: n, itemStyle: { color: nodeColor(n), borderWidth: 0 },
          ...(n === 'emo:other' && { label: { fontSize: 11, color: t.ink2 } }),
        })),
        // Bands leaving an emoji take the colour of the person receiving it.
        links: flow.links.map((l) => (l.source.startsWith('emo:') ? { ...l, lineStyle: { color: nodeColor(l.target) } } : l)),
      }],
    };
  }, [flow, mode, t, colorOf]);

  const perCol = Math.max(...['from:', 'emo:', 'to:'].map((pre) => flow.nodes.filter((n) => n.startsWith(pre)).length));
  return (
    <Panel
      title="Who reacts to whom"
      actions={
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-ink-3">
            {mode === 'people' && flow.shown < flow.total * 0.999 ? `biggest flows, ${fmtPct(flow.shown / Math.max(1, flow.total), 0)} of all · ` : ''}
            {mode === 'emoji' ? `top ${FLOW_PEOPLE} people and ${FLOW_EMOJI} emoji · ` : ''}click a band to read
          </span>
          <Segmented value={mode} options={[['people', 'Person → person'], ['emoji', 'Through emoji']] as [FlowMode, string][]} onChange={setMode} />
        </div>
      }
      bodyClassName="p-2"
    >
      {q.data && !q.data.length && !q.loading ? (
        <div className="p-3 text-ink-3">No reactions between people in this selection.</div>
      ) : (
        <EChart
          option={option}
          height={Math.max(320, perCol * 28 + 40)}
          dimmed={q.loading}
          on={{
            click: (p: { dataType: string; data: { source?: string; target?: string } }) => {
              if (p.dataType !== 'edge') return;
              const { source, target } = p.data as { source: string; target: string };
              const conds = [source, target].map((node) => {
                const v = strip(node);
                if (node.startsWith('from:')) return mode === 'people' ? `actor = ${lit(v)}` : nodeCond('actor', v, flow.reactors, REST);
                if (node.startsWith('to:')) return mode === 'people' ? `receiver = ${lit(v)}` : nodeCond('receiver', v, flow.authors, REST);
                return nodeCond('reaction', v, flow.emojis, 'other');
              });
              inspect({
                title: `${strip(source)} → ${strip(target)}`,
                where: `message_id IN (SELECT message_id FROM span_reactions WHERE actor <> receiver AND ${conds.join(' AND ')})`,
                from: 'span',
              });
            },
          }}
        />
      )}
    </Panel>
  );
}

/** Reactions as a network: people sized by reactions received, links by reactions exchanged. */
function ReactionNetwork({ openPerson }: { openPerson: (name: string) => void }) {
  const t = useChartTheme();
  const { colorOf, inspect, filters } = useConversation();
  const q = usePairReactions();

  const { option, links } = useMemo(() => {
    const directed = new Map<string, number>();
    const received = new Map<string, number>();
    const given = new Map<string, number>();
    for (const r of q.data ?? []) {
      directed.set(`${r.a}\u0000${r.b}`, (directed.get(`${r.a}\u0000${r.b}`) ?? 0) + r.n);
      received.set(r.b, (received.get(r.b) ?? 0) + r.n);
      given.set(r.a, (given.get(r.a) ?? 0) + r.n);
    }
    const pairs = new Map<string, { a: string; b: string; n: number }>();
    for (const [k, n] of directed) {
      const [a, b] = k.split('\u0000').sort();
      const p = pairs.get(`${a}\u0000${b}`) ?? { a, b, n: 0 };
      p.n += n;
      pairs.set(`${a}\u0000${b}`, p);
    }
    const maxEdge = Math.max(1, ...[...pairs.values()].map((p) => p.n));
    // Keep the readable backbone: strong links, plus each person's two strongest.
    const strongest = new Map<string, number[]>();
    for (const p of pairs.values()) for (const who of [p.a, p.b]) strongest.set(who, [...(strongest.get(who) ?? []), p.n]);
    const floor = new Map([...strongest].map(([who, ns]) => [who, ns.sort((x, y) => y - x)[Math.min(1, ns.length - 1)]]));
    const links = [...pairs.values()].filter((p) => p.n >= 2 && (p.n >= maxEdge * 0.12 || p.n >= floor.get(p.a)! || p.n >= floor.get(p.b)!));
    const people = [...new Set([...received.keys(), ...given.keys()])];
    const maxNode = Math.max(1, ...people.map((n) => received.get(n) ?? 0));
    const focus = new Set(filters.people);
    const base = baseOption(t);
    const dir = (a: string, b: string) => directed.get(`${a}\u0000${b}`) ?? 0;
    return {
      links,
      option: {
        ...base,
        tooltip: {
          ...base.tooltip,
          trigger: 'item',
          formatter: (p: { dataType: string; data: { name?: string; source?: string; target?: string } }) => {
            if (p.dataType === 'node') {
              const n = p.data.name!;
              return `<div style="font-weight:600;margin-bottom:4px">${esc(n)}</div>` +
                tipRow(colorOf(n), fmtInt(received.get(n) ?? 0), 'reactions received') + tipRow(t.ink2, fmtInt(given.get(n) ?? 0), 'reactions given');
            }
            const { source: a, target: b } = p.data as { source: string; target: string };
            return `<div style="margin-bottom:4px;opacity:.7">${esc(a)} ↔ ${esc(b)}</div>` +
              tipRow(colorOf(a), fmtInt(dir(a, b)), `${first(a)} → ${first(b)}`) +
              tipRow(colorOf(b), fmtInt(dir(b, a)), `${first(b)} → ${first(a)}`);
          },
        },
        series: [{
          type: 'graph',
          layout: 'force',
          roam: true,
          draggable: true,
          force: { repulsion: 320, gravity: 0.06, edgeLength: [50, 240], friction: 0.2 },
          emphasis: { focus: 'adjacency', lineStyle: { opacity: 0.9 } },
          label: { show: true, position: 'right', color: t.ink2, fontSize: 11, formatter: (p: { name: string }) => first(p.name) },
          data: people.map((n) => ({
            name: n,
            value: received.get(n) ?? 0,
            symbolSize: 10 + 38 * Math.sqrt((received.get(n) ?? 0) / maxNode),
            itemStyle: { color: colorOf(n), borderColor: t.surface, borderWidth: 2, opacity: focus.size && !focus.has(n) ? 0.35 : 1 },
          })),
          links: links.map((e) => ({
            source: e.a,
            target: e.b,
            value: e.n,
            lineStyle: { width: 0.75 + 7 * Math.pow(e.n / maxEdge, 0.7), color: t.muted, opacity: 0.45, curveness: 0.08 },
          })),
        }],
      },
    };
  }, [q.data, t, colorOf, filters.people]);

  return (
    <Panel title="Reaction network" actions={<span className="text-[11px] text-ink-3">size = reactions received · strongest links · click a person or a link</span>} bodyClassName="p-2">
      <EChart
        option={option}
        height={460}
        dimmed={q.loading}
        on={{
          click: (p: { dataType: string; data: { name?: string; source?: string; target?: string } }) => {
            if (p.dataType === 'node') openPerson(p.data.name!);
            else if (p.data.source && p.data.target) {
              const [a, b] = [lit(p.data.source), lit(p.data.target)];
              inspect({
                title: `Reactions between ${p.data.source} and ${p.data.target}`,
                where: `message_id IN (SELECT message_id FROM span_reactions WHERE (actor = ${a} AND receiver = ${b}) OR (actor = ${b} AND receiver = ${a}))`,
                from: 'span',
              });
            }
          },
        }}
      />
      {!links.length && !q.loading && <div className="p-3 text-ink-3">No reactions between people in this selection.</div>}
    </Panel>
  );
}

type AffinityMode = 'rate' | 'share' | 'n';
const AFFINITY_PEOPLE = 30;

/**
 * Reactor × author matrix. "Per 100 messages" corrects for how much each
 * author writes, so it shows real fondness rather than who talks the most.
 */
function ReactionAffinity() {
  const t = useChartTheme();
  const { seriesNames, colorOf, inspect } = useConversation();
  const where = useWhere();
  const [mode, setMode] = useState<AffinityMode>('rate');
  const q = useQuery<{ a: string; b: string; n: number; msgs: number }>(`
    WITH m AS (SELECT sender AS b, count(*) AS msgs FROM span GROUP BY 1),
    r AS (SELECT actor AS a, receiver AS b, count(*) AS n FROM span_reactions WHERE actor <> receiver AND ${where} GROUP BY 1, 2)
    SELECT r.a, r.b, r.n, m.msgs FROM r JOIN m USING (b)`);

  const { option, height, reactors, authors } = useMemo(() => {
    const rows = q.data ?? [];
    const given = new Map<string, number>(), msgs = new Map<string, number>();
    for (const r of rows) {
      given.set(r.a, (given.get(r.a) ?? 0) + r.n);
      msgs.set(r.b, r.msgs);
    }
    const top = (m: Map<string, number>, min: number) => {
      const keep = new Set([...m].filter(([, v]) => v >= min).sort((x, y) => y[1] - x[1]).slice(0, AFFINITY_PEOPLE).map(([k]) => k));
      return seriesNames.filter((n) => keep.has(n));
    };
    const reactors = top(given, 10), authors = top(msgs, 20);
    const y = [...reactors].reverse();
    const value = (r: (typeof rows)[number]) => (mode === 'rate' ? (r.n / r.msgs) * 100 : mode === 'share' ? (r.n / given.get(r.a)!) * 100 : r.n);
    const cells: [number, number, number][] = rows
      .filter((r) => reactors.includes(r.a) && authors.includes(r.b))
      .map((r) => [authors.indexOf(r.b), y.indexOf(r.a), value(r)]);
    const fmt = (v: number) => (mode === 'n' ? fmtInt(v) : mode === 'share' ? `${v.toFixed(0)}%` : v.toFixed(1));
    const option = gridHeatmap(t, {
      x: authors.map(first),
      y,
      cells,
      max: quantile(cells.map((c) => c[2]), 0.97),
      title: (_, a) => a,
      value: fmt,
      xRotate: authors.length > 8 ? 40 : 0,
      yColors: y.map(colorOf),
    });
    const label = mode === 'rate' ? `per 100 of the author’s messages` : mode === 'share' ? 'of the reactor’s reactions' : 'reactions';
    option.tooltip.formatter = (p: { value: [number, number, number] }) => {
      const a = y[p.value[1]], b = authors[p.value[0]];
      const r = rows.find((x) => x.a === a && x.b === b)!;
      return `<div style="margin-bottom:4px;opacity:.7">${esc(a)} → ${esc(b)}</div>` +
        tipRow(colorOf(a), fmt(p.value[2]), label) +
        tipRow(t.ink2, fmtInt(r.n), `reactions · ${fmtPct(r.n / given.get(a)!, 0)} of ${first(a)}’s, ${(r.n / r.msgs * 100).toFixed(1)} per 100 of ${first(b)}’s messages`);
    };
    return { option, reactors, authors, height: Math.max(220, y.length * rowHeight(y.length) + (authors.length > 8 ? 110 : 80)) };
  }, [q.data, mode, seriesNames, t, colorOf]);

  return (
    <Panel
      title="Reaction affinity"
      actions={
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-ink-3" title="Rows: people with 10+ reactions given. Columns: people with 20+ messages.">rows react to columns · click to read</span>
          <Segmented value={mode} options={[['rate', 'Per 100 msgs'], ['share', 'Row %'], ['n', 'Count']] as [AffinityMode, string][]} onChange={setMode} />
        </div>
      }
      bodyClassName="p-2"
    >
      {!q.loading && (!reactors.length || !authors.length) ? (
        <div className="p-3 text-ink-3">Not enough reactions in this selection.</div>
      ) : (
        <EChart
          option={option}
          height={height}
          dimmed={q.loading}
          on={{
            click: (p: { value: [number, number, number] }) => {
              const a = [...reactors].reverse()[p.value[1]], b = authors[p.value[0]];
              inspect({ title: `${a} reacting to ${b}`, where: `message_id IN (SELECT message_id FROM span_reactions WHERE actor = ${lit(a)} AND receiver = ${lit(b)})`, from: 'span' });
            },
          }}
        />
      )}
    </Panel>
  );
}

const PAIRS_SHOWN = 12;

/**
 * Mutual or one-sided: the pairs exchanging the most reactions, each split
 * into its two directions. The bigger giver is always on the left.
 */
function Reciprocity() {
  const t = useChartTheme();
  const { colorOf, inspect } = useConversation();
  const q = usePairReactions();
  const pairs = useMemo(() => {
    const directed = new Map<string, number>();
    for (const r of q.data ?? []) directed.set(`${r.a}\u0000${r.b}`, (directed.get(`${r.a}\u0000${r.b}`) ?? 0) + r.n);
    const seen = new Map<string, { a: string; b: string; ab: number; ba: number }>();
    for (const [k] of directed) {
      const [x, y] = k.split('\u0000');
      const key = [x, y].sort().join('\u0000');
      if (seen.has(key)) continue;
      const xy = directed.get(`${x}\u0000${y}`) ?? 0, yx = directed.get(`${y}\u0000${x}`) ?? 0;
      seen.set(key, xy >= yx ? { a: x, b: y, ab: xy, ba: yx } : { a: y, b: x, ab: yx, ba: xy });
    }
    return [...seen.values()].filter((p) => p.ab + p.ba >= 5).sort((x, y) => y.ab + y.ba - (x.ab + x.ba)).slice(0, PAIRS_SHOWN).reverse();
  }, [q.data]);

  const option = useMemo(() => {
    const base = baseOption(t);
    const max = Math.max(1, ...pairs.map((p) => p.ab));
    const side = (key: 'ab' | 'ba') => ({
      type: 'bar', stack: 'pair', barMaxWidth: 16,
      data: pairs.map((p) => ({
        value: key === 'ab' ? -p.ab : p.ba,
        itemStyle: { color: colorOf(key === 'ab' ? p.a : p.b), borderRadius: key === 'ab' ? [3, 0, 0, 3] : [0, 3, 3, 0] },
      })),
      label: {
        show: true, position: key === 'ab' ? 'left' : 'right', color: t.ink2, fontSize: 11,
        formatter: (p: { dataIndex: number }) => {
          const r = pairs[p.dataIndex];
          return key === 'ab' ? `${first(r.a)} ${fmtInt(r.ab)}` : `${fmtInt(r.ba)} ${first(r.b)}`;
        },
      },
    });
    return {
      ...base,
      grid: { ...base.grid, left: 100, right: 100, containLabel: false },
      tooltip: {
        ...base.tooltip,
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (ps: { dataIndex: number }[]) => {
          const r = pairs[ps[0].dataIndex];
          const ratio = r.ba ? `${(r.ab / r.ba).toFixed(1)}× more one way` : 'only one way';
          return `<div style="margin-bottom:4px;opacity:.7">${esc(r.a)} ↔ ${esc(r.b)} · ${ratio}</div>` +
            tipRow(colorOf(r.a), fmtInt(r.ab), `${first(r.a)} → ${first(r.b)}`) +
            tipRow(colorOf(r.b), fmtInt(r.ba), `${first(r.b)} → ${first(r.a)}`);
        },
      },
      xAxis: { type: 'value', min: -max, max, show: false },
      yAxis: { type: 'category', data: pairs.map((p) => `${p.a}\u0000${p.b}`), show: false },
      series: [side('ab'), side('ba')],
    };
  }, [pairs, t, colorOf]);

  return (
    <Panel title="Mutual or one-sided?" actions={<span className="text-[11px] text-ink-3">biggest giver on the left · click to read</span>} bodyClassName="p-2">
      {!q.loading && !pairs.length ? (
        <div className="p-3 text-ink-3">No pair exchanged 5+ reactions in this selection.</div>
      ) : (
        <EChart
          option={option}
          height={Math.max(200, pairs.length * 30 + 24)}
          dimmed={q.loading}
          on={{
            click: (p: { dataIndex: number; seriesIndex: number }) => {
              const r = pairs[p.dataIndex];
              const [a, b] = p.seriesIndex === 0 ? [r.a, r.b] : [r.b, r.a];
              inspect({ title: `${a} reacting to ${b}`, where: `message_id IN (SELECT message_id FROM span_reactions WHERE actor = ${lit(a)} AND receiver = ${lit(b)})`, from: 'span' });
            },
          }}
        />
      )}
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
    // Quadrants split at the group's medians.
    const med = (xs: number[]) => { const v = [...xs].sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : 0; };
    const mx = med(rows.map((r) => (r.given / r.msgs) * 100));
    const my = med(rows.map((r) => (r.received / r.msgs) * 100));
    const corner = (text: string, pos: Record<string, number | string>) => ({ type: 'text', ...pos, style: { text, fill: t.muted, fontSize: 11, fontWeight: 600 } });
    return {
      graphic: rows.length >= 4 ? [
        corner('Stars: get a lot, give little', { left: 60, top: 30 }),
        corner('Life of the party: give and get', { right: 30, top: 30 }),
        corner('Quiet ones', { left: 60, bottom: 34 }),
        corner('Fans: give more than they get', { right: 30, bottom: 34 }),
      ] : [],
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
        markLine: rows.length >= 4 ? {
          silent: true, symbol: 'none', lineStyle: { color: t.axis, type: 'dashed' }, label: { show: false },
          data: [{ xAxis: mx }, { yAxis: my }],
        } : undefined,
      }],
    };
  }, [rows, t, colorOf]);
  return (
    <Panel title="Generous vs appreciated" actions={<span className="text-[11px] text-ink-3">per 100 of each person’s messages · size = messages · click for profile</span>} bodyClassName="p-2">
      <EChart option={option} height={340} dimmed={q.loading} on={{ click: (p: { dataIndex: number }) => openPerson(rows[p.dataIndex].s) }} />
    </Panel>
  );
}

/** Reactions received per 100 messages, year by year, one small chart per person. */
function RateByYear({ openPerson }: { openPerson: (name: string) => void }) {
  const { seriesNames, filters } = useConversation();
  const q = useQuery<{ s: string; y: number; msgs: number; got: number }>(`
    SELECT sender AS s, year(ts) AS y, count(*) AS msgs, sum(n_reactions) AS got FROM span
    WHERE ${pairPeopleSql(filters, 'sender', 'sender')} GROUP BY 1, 2`);
  const data = q.data ?? [];
  const years = [...new Set(data.map((r) => r.y))].sort();
  const cards = seriesNames
    .map((name) => {
      const mine = data.filter((r) => r.s === name);
      const msgs = mine.reduce((a, r) => a + r.msgs, 0);
      const got = mine.reduce((a, r) => a + r.got, 0);
      // Years with under 20 messages would make the line jumpy; they show as gaps.
      const rates = years.map((y) => { const r = mine.find((x) => x.y === y); return r && r.msgs >= 20 ? (r.got / r.msgs) * 100 : 0; });
      return { name, msgs, rate: msgs ? (got / msgs) * 100 : 0, rates };
    })
    .filter((c) => c.msgs >= 20);
  const max = Math.max(1, ...cards.flatMap((c) => c.rates));
  return (
    <Panel title="Reactions per 100 messages, year by year" actions={<span className="text-[11px] text-ink-3">{years[0]}–{years[years.length - 1]} · same scale for everyone · click for profile</span>}>
      <div className={`grid grid-cols-2 gap-px bg-line @3xl:grid-cols-3 ${q.loading ? 'opacity-50' : ''}`}>
        {cards.map((c) => (
          <button key={c.name} onClick={() => openPerson(c.name)} className="min-w-0 bg-surface p-2.5 text-left hover:bg-surface-2">
            <div className="flex items-center gap-1.5">
              <Badge name={c.name} size={16} />
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{c.name}</span>
              <span className="num text-[11px] text-ink-2">{c.rate.toFixed(1)}</span>
            </div>
            <div className="mt-1.5"><ScaledSpark values={c.rates} max={max} name={c.name} /></div>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function ScaledSpark({ values, max, name }: { values: number[]; max: number; name: string }) {
  const { colorOf } = useConversation();
  const W = 200, H = 28;
  const w = W / Math.max(1, values.length);
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block" aria-hidden>
      {values.map((v, i) => {
        const h = v ? Math.max(1.5, (v / max) * H) : 0;
        return <rect key={i} x={i * w + 0.5} y={H - h} width={Math.max(1, w - 1.5)} height={h} rx={1} fill={colorOf(name)} />;
      })}
    </svg>
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
  const { conv } = useConversation();
  // With two people the network, matrix and pairs have nothing to show that the flow doesn't.
  const group = conv.people.filter((p) => p.messages > 0).length > 2;
  return (
    <div className="space-y-3 p-4">
      <KpiRow />
      <div className={`grid grid-cols-1 gap-3 ${group ? '@5xl:grid-cols-2' : ''}`}>
        {group && <ReactionNetwork openPerson={openPerson} />}
        <ReactionFlow />
      </div>
      {group && (
        <div className="grid grid-cols-1 gap-3 @5xl:grid-cols-[3fr_2fr]">
          <ReactionAffinity />
          <Reciprocity />
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 @5xl:grid-cols-[3fr_2fr]">
        <MessagesVsReactions openPerson={openPerson} />
        <ReceivedTotals openPerson={openPerson} />
      </div>
      <div className="grid grid-cols-1 gap-3 @5xl:grid-cols-[2fr_3fr]">
        <TopReactions />
        <ReactionFingerprints />
      </div>
      <div className="grid grid-cols-1 gap-3 @4xl:grid-cols-2">
        <GenerousVsAppreciated openPerson={openPerson} />
        <RateByYear openPerson={openPerson} />
      </div>
      <MostReacted />
    </div>
  );
}
