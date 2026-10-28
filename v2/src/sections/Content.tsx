// Content: what people actually say. Words and phrases, each person's
// signature vocabulary, word trends over time, message length, emoji and links.
import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useConversation } from '../app/ConversationProvider';
import { matrixPeople } from '../app/relations';
import { tokensSql, useExcludedWords, useWordIndex, wordFilterSql } from '../app/words';
import { EChart } from '../charts/EChart';
import { personHeatmap } from '../charts/heatmap';
import { baseOption, esc, legend, tipRow, useChartTheme } from '../charts/theme';
import { lit } from '../db/duckdb';
import { useQuery } from '../db/useQuery';
import { fmtCompact, fmtInt, fmtPct } from '../lib/format';
import { DAY, MONTHS, tsLit } from '../lib/time';
import { Panel, Segmented, Stat } from '../ui/primitives';
import { Badge } from '../ui/Badge';

const EMOJI_RE = `[\\x{1F300}-\\x{1F3FA}\\x{1F400}-\\x{1FAFF}\\x{2600}-\\x{27BF}]`;
const URL_RE = `https?://[^\\s]+`;

/** Messages in `sel` containing a word (as the index tokenises it). */
const wordWhere = (w: string) => `message_id IN (SELECT message_id FROM sel_words WHERE w = ${lit(w)})`;
/** Messages containing a phrase; plain substring match on normalised text. */
const phraseWhere = (p: string) => (p.includes(' ') ? `contains(replace(lower(text), '’', ''''), ${lit(p)})` : wordWhere(p));

// --- Search + KPIs ------------------------------------------------------------------

function FindBox() {
  const { inspect } = useConversation();
  const [q, setQ] = useState('');
  const go = () => {
    const s = q.trim();
    if (s) inspect({ title: `“${s}”`, where: `text ILIKE ${lit(`%${s.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`)} ESCAPE '\\'` });
  };
  return (
    <label className="flex h-9 w-full max-w-xl items-center gap-2 rounded-md border border-line bg-surface px-3 focus-within:border-accent">
      <Search size={14} className="text-ink-3" />
      <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} placeholder="Find words in this selection… (Enter)" className="w-full bg-transparent outline-none" />
    </label>
  );
}

function KpiRow() {
  const k = useQuery<{ words: number; vocab: number; texts: number; longest: number; questions: number; emoji: number; links: number }>(`
    SELECT (SELECT count(*) FROM sel_words) AS words,
           (SELECT count(DISTINCT w) FROM sel_words) AS vocab,
           (SELECT count(*) FROM sel WHERE kind = 'text') AS texts,
           (SELECT coalesce(max(words), 0) FROM sel) AS longest,
           (SELECT count(*) FROM sel WHERE kind = 'text' AND trim(text) LIKE '%?') AS questions,
           (SELECT coalesce(sum(len(regexp_extract_all(text, '${EMOJI_RE}'))), 0) FROM sel WHERE text IS NOT NULL) AS emoji,
           (SELECT count(*) FROM sel WHERE kind = 'link' OR regexp_matches(text, '${URL_RE}')) AS links`).data?.[0];
  return (
    <div className="grid grid-cols-3 gap-3 @5xl:grid-cols-6">
      <Stat label="Words" value={fmtCompact(k?.words)} sub={k?.texts ? `${(k.words / k.texts).toFixed(1)} per text message` : undefined} />
      <Stat label="Vocabulary" value={fmtInt(k?.vocab)} sub="different words" />
      <Stat label="Longest message" value={k ? `${fmtInt(k.longest)} words` : '–'} />
      <Stat label="Questions" value={k?.texts ? fmtPct(k.questions / k.texts) : '–'} sub={k ? `${fmtInt(k.questions)} messages end with ?` : undefined} />
      <Stat label="Emoji in text" value={fmtInt(k?.emoji)} sub={k?.texts ? `${((k.emoji / k.texts) * 100).toFixed(1)} per 100 messages` : undefined} />
      <Stat label="Links shared" value={fmtInt(k?.links)} />
    </div>
  );
}

// --- Top words & phrases ------------------------------------------------------------------

type Gram = '1' | '2' | '3';

function ngramSql(n: Gram, filter: (col: string) => string): string {
  if (n === '1') return `SELECT w AS g, count(*) AS n FROM sel_words WHERE ${filter('w')} GROUP BY 1`;
  const leads = n === '2' ? ['b'] : ['b', 'c'];
  const cols = leads.map((c, i) => `lead(w, ${i + 1}) OVER (PARTITION BY message_id ORDER BY pos) AS ${c}`).join(', ');
  const all = ['a', ...leads];
  // Keep a phrase unless every one of its words would be hidden on its own.
  return `
    SELECT ${all.join(" || ' ' || ")} AS g, count(*) AS n FROM (SELECT w AS a, ${cols} FROM sel_words)
    WHERE ${leads.map((c) => `${c} IS NOT NULL`).join(' AND ')} AND (${all.map((c) => filter(c)).join(' OR ')})
    GROUP BY 1 HAVING count(*) >= 3`;
}

function TopWords({ hideCommon, setHideCommon }: { hideCommon: boolean; setHideCommon: (v: boolean) => void }) {
  const { inspect } = useConversation();
  const [gram, setGram] = useState<Gram>('1');
  const [excluded, setExcluded] = useExcludedWords();
  const filter = (c: string) => wordFilterSql(c, hideCommon, excluded);
  const q = useQuery<{ g: string; n: number }>(`${ngramSql(gram, filter)} ORDER BY n DESC LIMIT 40`);
  const rows = q.data ?? [];
  const max = rows[0]?.n ?? 1;
  return (
    <Panel
      title={gram === '1' ? 'Top words' : 'Top phrases'}
      actions={
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-ink-3">
            <input type="checkbox" checked={hideCommon} onChange={(e) => setHideCommon(e.target.checked)} className="accent-[var(--color-accent)]" />
            hide common words
          </label>
          <Segmented value={gram} options={[['1', 'Words'], ['2', '2-word'], ['3', '3-word']]} onChange={setGram} />
        </div>
      }
    >
      <div className={`grid max-h-[580px] grid-flow-col grid-cols-2 gap-x-4 overflow-auto px-3 py-2 ${q.loading ? 'opacity-50' : ''}`} style={{ gridTemplateRows: `repeat(${Math.ceil(rows.length / 2)}, auto)` }}>
        {rows.map((r, i) => (
          <div key={r.g} className="group flex h-7 items-center gap-2">
            <span className="num w-5 text-right text-[11px] text-ink-3">{i + 1}</span>
            <button onClick={() => inspect({ title: `“${r.g}”`, where: phraseWhere(r.g) })} className="relative flex h-6 min-w-0 flex-1 items-center rounded px-1.5 text-left hover:bg-surface-2">
              <span className="absolute inset-y-1 left-0 rounded bg-accent-soft" style={{ width: `${(r.n / max) * 100}%` }} />
              <span className="relative truncate">{r.g}</span>
            </button>
            <span className="num w-12 text-right text-ink-2">{fmtInt(r.n)}</span>
            {gram === '1' && (
              <button title="Hide this word everywhere" onClick={() => setExcluded([...excluded, r.g])} className="invisible text-ink-3 hover:text-danger group-hover:visible">
                <X size={13} />
              </button>
            )}
          </div>
        ))}
        {!rows.length && !q.loading && <div className="col-span-2 py-2 text-ink-3">Nothing to show.</div>}
      </div>
      {excluded.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 border-t border-line px-3 py-2 text-[11px]">
          <span className="text-ink-3">Hidden:</span>
          {excluded.map((w) => (
            <button key={w} onClick={() => setExcluded(excluded.filter((x) => x !== w))} className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 hover:text-danger">
              {w} <X size={10} />
            </button>
          ))}
          <button onClick={() => setExcluded([])} className="ml-1 text-accent">reset</button>
        </div>
      )}
    </Panel>
  );
}

// --- Signature words ------------------------------------------------------------------------

/**
 * Words each person uses far more than everyone else, ranked by the z-score
 * of a log-odds ratio with an informative Dirichlet prior (Monroe et al.,
 * "Fightin' Words"). Frequent-and-distinctive beats rare-and-quirky.
 */
function SignatureWords({ hideCommon }: { hideCommon: boolean }) {
  const { conv, colorOf, inspect } = useConversation();
  const [excluded] = useExcludedWords();
  const { fold } = matrixPeople(conv);
  const q = useQuery<{ s: string; w: string; n: number; z: number }>(`
    WITH c AS (SELECT ${fold('sender')} AS s, w, count(*) AS n FROM sel_words WHERE ${wordFilterSql('w', hideCommon, excluded)} GROUP BY 1, 2),
    tot AS (SELECT w, sum(n) AS n FROM c GROUP BY 1 HAVING sum(n) >= 5),
    ps AS (SELECT s, sum(n) AS n FROM c GROUP BY 1),
    a AS (SELECT sum(n) AS n FROM tot),
    scored AS (
      SELECT c.s, c.w, c.n,
             tot.n * 500.0 / a.n AS prior,                -- prior pseudo-counts, 500 in total
             tot.n - c.n AS other_n,
             ps.n AS p_n, a.n - ps.n AS o_n
      FROM c JOIN tot USING (w) JOIN ps USING (s), a
    )
    SELECT s, w, n, z FROM (
      SELECT s, w, n,
             (ln((n + prior) / (p_n + 500 - n - prior)) - ln((other_n + prior) / (o_n + 500 - other_n - prior)))
               / sqrt(1 / (n + prior) + 1 / (other_n + prior)) AS z,
             row_number() OVER (PARTITION BY s ORDER BY
               (ln((n + prior) / (p_n + 500 - n - prior)) - ln((other_n + prior) / (o_n + 500 - other_n - prior)))
               / sqrt(1 / (n + prior) + 1 / (other_n + prior)) DESC) AS r
      FROM scored WHERE n >= 3
    ) WHERE r <= 12 ORDER BY s, z DESC`);
  const people = conv.people.filter((p) => q.data?.some((r) => r.s === p.name));
  return (
    <Panel title="Signature words" actions={<span className="text-[11px] text-ink-3">words each person uses much more than the others · click to read</span>}>
      <div className={`grid grid-cols-2 gap-px bg-line @4xl:grid-cols-4 ${q.loading ? 'opacity-50' : ''}`}>
        {people.map((p) => {
          const words = q.data!.filter((r) => r.s === p.name);
          const maxZ = Math.max(1, ...words.map((w) => w.z));
          return (
            <div key={p.name} className="bg-surface p-3">
              <div className="mb-1.5 flex items-center gap-2 font-medium">
                <Badge name={p.name} />
                <span className="truncate">{p.name}</span>
              </div>
              {words.map((w) => (
                <button key={w.w} onClick={() => inspect({ title: `${p.name}: “${w.w}”`, where: `sender = ${lit(p.name)} AND ${wordWhere(w.w)}` })}
                  className="relative flex h-6 w-full items-center gap-2 rounded px-1.5 text-left hover:bg-surface-2">
                  <span className="absolute inset-y-1 left-0 rounded opacity-20" style={{ width: `${(Math.max(0, w.z) / maxZ) * 100}%`, background: colorOf(p.name) }} />
                  <span className="relative min-w-0 flex-1 truncate">{w.w}</span>
                  <span className="num relative text-[11px] text-ink-3">{fmtInt(w.n)}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {q.data?.length === 0 && <div className="p-3 text-ink-3">Not enough text in this selection.</div>}
    </Panel>
  );
}

function Vocabulary({ hideCommon }: { hideCommon: boolean }) {

  const [excluded] = useExcludedWords();
  const q = useQuery<{ sender: string; words: number; vocab: number; texts: number; own: number }>(`
    WITH c AS (SELECT sender, w, count(*) AS n FROM sel_words GROUP BY 1, 2),
    users AS (SELECT w, count(*) AS k FROM c GROUP BY 1)
    SELECT c.sender, sum(c.n) AS words, count(*) AS vocab,
           (SELECT count(*) FROM sel s WHERE s.sender = c.sender AND kind = 'text') AS texts,
           count(*) FILTER (users.k = 1 AND c.n >= 3 AND ${wordFilterSql('c.w', hideCommon, excluded)}) AS own
    FROM c JOIN users USING (w) GROUP BY 1 ORDER BY words DESC`);
  const th = 'border-b border-line px-2 py-1.5 text-right align-bottom font-medium leading-tight';
  const td = 'num border-b border-line/60 px-2 text-right';
  return (
    <Panel title="Vocabulary by person">
      <div className={`max-h-[380px] overflow-auto ${q.loading ? 'opacity-50' : ''}`}>
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 bg-surface text-ink-3">
            <tr>
              <th className={`${th} text-left`}>Person</th>
              <th className={th}>Words</th>
              <th className={th}>Words / message</th>
              <th className={th}>Different words</th>
              <th className={th} title="Words they used 3+ times that nobody else used">Only they use</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.map((r) => (
              <tr key={r.sender}>
                <td className="max-w-48 truncate border-b border-line/60 px-3 py-1">
                  <Badge name={r.sender} className="mr-2 align-middle" />
                  {r.sender}
                </td>
                <td className={td}>{fmtInt(r.words)}</td>
                <td className={td}>{r.texts ? (r.words / r.texts).toFixed(1) : '–'}</td>
                <td className={td}>{fmtInt(r.vocab)}</td>
                <td className={td}>{fmtInt(r.own)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

// --- Word trends ----------------------------------------------------------------------------

function WordTrends({ seed }: { seed: string[] }) {
  const t = useChartTheme();
  const { conv, inspect } = useConversation();
  const [draft, setDraft] = useState<string | null>(null);
  const terms = (draft ?? seed.join(', ')).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 6);
  const [applied, setApplied] = useState<string[] | null>(null);
  const active = applied ?? terms;
  const grain = (conv.lastTs - conv.firstTs) / DAY > 4 * 365 ? 'quarter' : 'month';
  const q = useQuery<{ b: number; term: string; n: number; total: number }>(
    active.length
      ? `WITH m AS (SELECT date_trunc('${grain}', ts) AS b, ${tokensSql('text')} AS l, replace(lower(text), '’', '''') AS t FROM sel WHERE kind = 'text'),
         terms(term) AS (VALUES ${active.map((x) => `(${lit(x)})`).join(', ')})
         SELECT epoch_ms(m.b) AS b, terms.term,
                count(*) FILTER (CASE WHEN contains(terms.term, ' ') THEN contains(m.t, terms.term) ELSE list_contains(m.l, terms.term) END) AS n,
                count(*) AS total
         FROM m, terms GROUP BY 1, 2 ORDER BY 1`
      : null,
  );
  const label = (ms: number) => {
    const d = new Date(ms);
    return grain === 'quarter' ? `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}` : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };
  const data = q.data ?? [];
  const buckets = [...new Set(data.map((r) => r.b))];
  const option = useMemo(() => {
    const base = baseOption(t);
    return {
      ...base,
      grid: { ...base.grid, top: 36 },
      legend: legend(t, active, 'line'),
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: t.axis } },
        formatter: (ps: { seriesName: string; value: number; color: string; dataIndex: number }[]) =>
          `<div style="margin-bottom:4px;opacity:.7">${esc(label(buckets[ps[0].dataIndex]))} · per 1,000 messages</div>` +
          [...ps].sort((a, b) => b.value - a.value).map((p) => tipRow(p.color, p.value.toFixed(1), p.seriesName)).join(''),
      },
      xAxis: { type: 'category', data: buckets.map(label), boundaryGap: false, ...base.axisCommon, splitLine: { show: false } },
      yAxis: { type: 'value', ...base.axisCommon, axisLine: { show: false } },
      series: active.map((term, i) => ({
        name: term, type: 'line', symbol: 'none', smooth: 0.2,
        lineStyle: { width: 2, color: t.series[i] }, itemStyle: { color: t.series[i] },
        emphasis: { focus: 'series' },
        data: buckets.map((b) => { const r = data.find((d) => d.b === b && d.term === term); return r && r.total ? (r.n / r.total) * 1000 : 0; }),
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data, t, active.join()]);
  return (
    <Panel
      title="Word trends"
      actions={
        <form className="flex items-center gap-2" onSubmit={(e) => (e.preventDefault(), setApplied(terms))}>
          <input
            value={draft ?? seed.join(', ')}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="words or phrases, comma-separated"
            className="h-6 w-80 rounded border border-line bg-surface-2 px-2 text-[12px] outline-none focus:border-accent"
          />
          <button className="h-6 rounded bg-accent px-2 text-[11px] font-medium text-white">Plot</button>
        </form>
      }
      bodyClassName="p-2"
    >
      <EChart
        option={option}
        height={300}
        dimmed={q.loading}
        on={{
          click: (p: { seriesName: string; dataIndex: number }) => {
            const b = buckets[p.dataIndex];
            const next = buckets[p.dataIndex + 1] ?? b + (grain === 'quarter' ? 92 : 31) * DAY;
            inspect({ title: `“${p.seriesName}” · ${label(b)}`, where: `ts >= ${tsLit(b)} AND ts < ${tsLit(next)} AND ${phraseWhere(p.seriesName)}` });
          },
        }}
      />
    </Panel>
  );
}

// --- Length, emoji, links ---------------------------------------------------------------------

const LENGTHS: [string, number][] = [['1', 1], ['2–3', 3], ['4–7', 7], ['8–15', 15], ['16–31', 31], ['32+', Infinity]];

function MessageLength() {
  const t = useChartTheme();
  const { seriesNames, colorOf } = useConversation();
  const q = useQuery<{ s: string; b: number; n: number }>(`
    SELECT sender AS s,
           CASE ${LENGTHS.filter(([, m]) => m !== Infinity).map(([, m], i) => `WHEN words <= ${m} THEN ${i}`).join(' ')} ELSE ${LENGTHS.length - 1} END AS b,
           count(*) AS n
    FROM sel WHERE kind = 'text' AND words > 0 GROUP BY 1, 2`);
  const { option, height } = useMemo(() => {
    const values = new Map<string, number[]>();
    for (const r of q.data ?? []) {
      let arr = values.get(r.s);
      if (!arr) values.set(r.s, (arr = new Array(LENGTHS.length).fill(0)));
      arr[r.b] = r.n;
    }
    return personHeatmap(t, {
      people: seriesNames, colorOf, x: LENGTHS.map((l) => `${l[0]} words`), values, rowShare: true,
      title: (x, p) => `${p} · ${x}`,
      value: (v) => `${v.toFixed(0)}% of their text messages`,
      legend: ['more', 'less'],
    });
  }, [q.data, seriesNames, colorOf, t]);
  return (
    <Panel title="Message length" actions={<span className="text-[11px] text-ink-3">each row is one person’s text messages</span>} bodyClassName="p-2">
      <EChart option={option} height={height} dimmed={q.loading} />
    </Panel>
  );
}

function RankedList({ rows, onPick, big }: { rows: { k: string; n: number }[]; onPick: (k: string) => void; big?: boolean }) {
  const max = rows[0]?.n ?? 1;
  return (
    <div className="max-h-[300px] overflow-auto px-3 py-2">
      {rows.map((r) => (
        <button key={r.k} onClick={() => onPick(r.k)} className="flex h-7 w-full items-center gap-2 rounded px-1 text-left hover:bg-surface-2">
          <span className={`min-w-0 truncate ${big ? 'w-8 text-center text-[16px]' : 'w-44'}`}>{r.k}</span>
          <span className="h-1.5 flex-1 rounded-full bg-surface-2"><span className="block h-full rounded-full bg-accent" style={{ width: `${(r.n / max) * 100}%` }} /></span>
          <span className="num w-14 text-right text-ink-2">{fmtInt(r.n)}</span>
        </button>
      ))}
      {!rows.length && <div className="text-ink-3">None in this selection.</div>}
    </div>
  );
}

function EmojiAndLinks() {
  const { inspect } = useConversation();
  const emoji = useQuery<{ k: string; n: number }>(`
    SELECT e AS k, count(*) AS n FROM (SELECT unnest(regexp_extract_all(text, '${EMOJI_RE}')) AS e FROM sel WHERE text IS NOT NULL)
    GROUP BY 1 ORDER BY n DESC LIMIT 30`);
  const domains = useQuery<{ k: string; n: number }>(`
    WITH u AS (
      SELECT link AS u FROM sel WHERE link IS NOT NULL
      UNION ALL SELECT unnest(regexp_extract_all(text, '${URL_RE}')) FROM sel WHERE kind <> 'link' AND text LIKE '%http%'
    )
    SELECT regexp_extract(u, '^https?://(?:www\\.|m\\.)?([^/:?#]+)', 1) AS k, count(*) AS n FROM u GROUP BY 1 HAVING k <> '' ORDER BY n DESC LIMIT 30`);
  return (
    <div className="grid grid-cols-1 gap-3 @4xl:grid-cols-2">
      <Panel title="Emoji in messages" actions={<span className="text-[11px] text-ink-3">click to read</span>}>
        <RankedList big rows={emoji.data ?? []} onPick={(e) => inspect({ title: `Messages with ${e}`, where: `contains(text, ${lit(e)})` })} />
      </Panel>
      <Panel title="Most shared sites" actions={<span className="text-[11px] text-ink-3">click to read</span>}>
        <RankedList rows={domains.data ?? []} onPick={(d) => inspect({ title: `Links to ${d}`, where: `contains(coalesce(link, '') || ' ' || coalesce(text, ''), ${lit(d)})` })} />
      </Panel>
    </div>
  );
}

function ContentBody() {
  const [hideCommon, setHideCommon] = useState(true);
  const [excluded] = useExcludedWords();
  const seed = useQuery<{ w: string }>(`SELECT w FROM sel_words WHERE ${wordFilterSql('w', true, excluded)} AND length(w) > 2 GROUP BY 1 ORDER BY count(*) DESC LIMIT 3`).data;
  return (
    <div className="space-y-3 p-4">
      <FindBox />
      <KpiRow />
      <div className="grid grid-cols-1 gap-3 @5xl:grid-cols-[3fr_2fr]">
        <TopWords hideCommon={hideCommon} setHideCommon={setHideCommon} />
        <Vocabulary hideCommon={hideCommon} />
      </div>
      <SignatureWords hideCommon={hideCommon} />
      {seed && <WordTrends seed={seed.map((r) => r.w)} />}
      <MessageLength />
      <EmojiAndLinks />
    </div>
  );
}

export function Content() {
  const { conv } = useConversation();
  const ready = useWordIndex(conv.threadId);
  if (!ready) return <div className="flex h-full items-center justify-center text-ink-3">Indexing the words of {fmtInt(conv.messages)} messages…</div>;
  return <ContentBody />;
}
