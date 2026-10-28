// Data layer for the Messages reader. The current selection (optionally
// narrowed to search matches) is numbered once into a temp table, then
// read in pages as the list scrolls:
//
//   reader   rn (0-based position), message_id, ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { getEngine, lit, run } from '../db/duckdb';
import type { Attachment } from '../media/AttachmentStrip';

export type SearchMode = 'text' | 'word' | 'regex';
export interface Search {
  q: string;
  mode: SearchMode;
}

export type ReaderMsg = {
  rn: number;
  message_id: number;
  ts: number;
  sender: string;
  kind: string;
  text: string | null;
  link: string | null;
  n_attachments: number;
  call_duration: number | null;
  call_missed: boolean | null;
  reactions: { a: string; e: string }[];
  attachments: Attachment[];
  hit: boolean;
};

const PAGE = 200;
const HAYSTACK = `coalesce(text, '') || ' ' || coalesce(link, '')`;

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** SQL predicate for a search, or null when there is none. Text and word modes ignore case and accents. */
export function searchSql(s: Search): string | null {
  const q = s.q.trim();
  if (!q) return null;
  if (s.mode === 'regex') return `regexp_matches(${HAYSTACK}, ${lit(q)}, 'i')`;
  const hay = `strip_accents(lower(${HAYSTACK}))`;
  if (s.mode === 'text') return `contains(${hay}, ${lit(fold(q))})`;
  return `regexp_matches(${hay}, ${lit(`(^|[^\\p{L}\\p{N}])${escapeRe(fold(q))}($|[^\\p{L}\\p{N}])`)})`;
}

const ACCENTS: Record<string, string> = { a: 'aàáâäãå', e: 'eéèêë', i: 'iíìîï', o: 'oóòôöõ', u: 'uúùûü', c: 'cç', n: 'nñ', y: 'yýÿ' };

/** The same search as a JS RegExp, for highlighting matches in rendered text. */
export function searchRegExp(s: Search): RegExp | null {
  const q = s.q.trim();
  if (!q) return null;
  try {
    if (s.mode === 'regex') return new RegExp(q, 'giu');
    const body = [...fold(q)].map((ch) => (ACCENTS[ch] ? `[${ACCENTS[ch]}]` : escapeRe(ch))).join('');
    return s.mode === 'word' ? new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'giu') : new RegExp(body, 'giu');
  } catch {
    return null;
  }
}

export interface ReaderState {
  /** Bumps whenever the index is rebuilt; positions from older versions are meaningless. */
  version: number;
  total: number;
  /** Positions of matches when highlighting in context (not when filtering to matches). */
  hits: number[] | null;
  months: { b: number; n: number; first: number }[];
  bySender: { sender: string; n: number }[];
  error: string | null;
  building: boolean;
}

export function useReader(epoch: number, search: Search, onlyMatches: boolean) {
  const pred = searchSql(search);
  const [state, setState] = useState<ReaderState>({ version: 0, total: 0, hits: null, months: [], bySender: [], error: null, building: true });
  const pages = useRef(new Map<number, ReaderMsg[]>());
  const pending = useRef(new Set<number>());
  const seq = useRef(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (epoch === 0) return;
    const mine = ++seq.current;
    setState((s) => ({ ...s, building: true, error: null }));
    (async () => {
      const { conn } = await getEngine();
      await conn.query(`
        CREATE OR REPLACE TEMP TABLE reader AS
        SELECT (row_number() OVER (ORDER BY ts, message_id) - 1)::INTEGER AS rn, message_id, ts
        FROM sel ${pred && onlyMatches ? `WHERE ${pred}` : ''}`);
      const [{ n }] = (await run<{ n: number }>(`SELECT count(*) AS n FROM reader`)).rows;
      const months = (await run<{ b: number; n: number; first: number }>(`
        SELECT epoch_ms(date_trunc('month', ts)) AS b, count(*) AS n, min(rn) AS first FROM reader GROUP BY 1 ORDER BY 1`)).rows;
      const hits = pred && !onlyMatches
        ? (await run<{ rn: number }>(`SELECT rn FROM reader JOIN sel USING (message_id) WHERE ${pred} ORDER BY rn LIMIT 100000`)).rows.map((r) => r.rn)
        : null;
      const bySender = pred ? (await run<{ sender: string; n: number }>(`SELECT sender, count(*) AS n FROM sel WHERE ${pred} GROUP BY 1 ORDER BY n DESC`)).rows : [];
      if (mine !== seq.current) return;
      pages.current = new Map();
      pending.current = new Set();
      setState((s) => ({ version: s.version + 1, total: n, hits, months, bySender, error: null, building: false }));
    })().catch((e: unknown) => {
      if (mine === seq.current) setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e), building: false }));
    });
  }, [epoch, pred, onlyMatches]);

  const version = state.version;
  const versionRef = useRef(version);
  versionRef.current = version;
  const ensure = useCallback(
    (start: number, end: number) => {
      for (let p = Math.floor(start / PAGE); p <= Math.floor(end / PAGE); p++) {
        if (pages.current.has(p) || pending.current.has(p)) continue;
        pending.current.add(p);
        const v = version;
        run<Omit<ReaderMsg, 'reactions' | 'attachments'> & { reactions: string | null; attachments: string | null }>(`
          SELECT r.rn, m.message_id, epoch_ms(m.ts) AS ts, m.sender, m.kind, m.text, m.link, m.n_attachments, m.call_duration, m.call_missed,
                 (SELECT to_json(list({'a': actor, 'e': reaction}))::VARCHAR FROM reactions x WHERE x.message_id = m.message_id) AS reactions,
                 (SELECT to_json(list({'t': type, 'u': uri} ORDER BY uri))::VARCHAR FROM attachments a WHERE a.message_id = m.message_id) AS attachments,
                 ${pred ?? 'FALSE'} AS hit
          FROM reader r JOIN messages m USING (message_id)
          WHERE r.rn BETWEEN ${p * PAGE} AND ${p * PAGE + PAGE - 1} ORDER BY r.rn`)
          .then(({ rows }) => {
            if (v !== versionRef.current) return;
            pages.current.set(p, rows.map((r) => ({
              ...r,
              reactions: r.reactions ? JSON.parse(r.reactions) ?? [] : [],
              attachments: r.attachments ? JSON.parse(r.attachments) ?? [] : [],
            })));
            setTick((t) => t + 1);
          })
          .catch((e: unknown) => console.error('Reader page failed', e))
          .finally(() => pending.current.delete(p));
      }
    },
    [version, pred],
  );

  const row = (i: number): ReaderMsg | undefined => pages.current.get(Math.floor(i / PAGE))?.[i % PAGE];

  const positionOf = useCallback(async (messageId: number) =>
    (await run<{ rn: number }>(`SELECT rn FROM reader WHERE message_id = ${messageId}`)).rows[0]?.rn ?? null, []);
  const positionAtDate = useCallback(async (isoDay: string) =>
    (await run<{ rn: number | null }>(`SELECT min(rn) AS rn FROM reader WHERE ts >= DATE ${lit(isoDay)}`)).rows[0]?.rn ?? null, []);

  return { ...state, ensure, row, positionOf, positionAtDate };
}
