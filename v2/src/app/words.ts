// Word index for the open conversation, built on demand by the Content
// section: one row per word of every text message.
//
//   words_<thread>  message_id, sender, ts, pos, w   (temp table, per conversation)
//   sel_words       words of messages in `sel` (a view, so it follows the filters)
//   stopwords       w
import { useEffect, useState, useSyncExternalStore } from 'react';
import { getEngine, lit } from '../db/duckdb';
import { STOPWORDS } from '../lib/stopwords';

// Letters, then letters/digits, keeping inner apostrophes ("aujourd'hui").
const TOKEN = `\\p{L}[\\p{L}\\p{N}]*(?:''\\p{L}+)*`;
// French elisions (l', d', j', qu'…) are dropped from the whole text in one
// pass first; doing it per token is ~15x slower on big conversations.
const ELISION = `(^|[^\\p{L}])(l|d|j|m|t|s|n|c|qu|jusqu|lorsqu|puisqu)''`;

/** SQL that tokenises a text expression the same way the index does. */
export const tokensSql = (expr: string) =>
  `regexp_extract_all(regexp_replace(replace(lower(${expr}), '’', ''''), '${ELISION}', '\\1', 'g'), '${TOKEN}')`;

const built = new Map<number, Promise<void>>();

let stopwords: Promise<void> | null = null;

export function ensureStopwords(): Promise<void> {
  stopwords ??= getEngine().then(({ conn }) =>
    conn.query(`CREATE TEMP TABLE IF NOT EXISTS stopwords AS SELECT unnest([${STOPWORDS.map(lit).join(', ')}]) AS w`).then(() => undefined));
  return stopwords;
}

function build(threadId: number): Promise<void> {
  let p = built.get(threadId);
  if (!p) {
    p = (async () => {
      const { conn } = await getEngine();
      await ensureStopwords();
      await conn.query(`
        CREATE TEMP TABLE IF NOT EXISTS words_${threadId} AS
        SELECT message_id, sender, ts, unnest(l) AS w, unnest(range(1, len(l) + 1)) AS pos
        FROM (SELECT message_id, sender, ts, ${tokensSql('text')} AS l
              FROM messages WHERE thread_id = ${threadId} AND kind = 'text' AND text IS NOT NULL)`);
    })();
    built.set(threadId, p);
    p.catch(() => built.delete(threadId));
  }
  return p;
}

/** Ensures the index exists and points `sel_words` at it; true once queries can run. */
export function useWordIndex(threadId: number): boolean {
  const [ready, setReady] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    build(threadId)
      .then(async () => {
        const { conn } = await getEngine();
        await conn.query(`CREATE OR REPLACE TEMP VIEW sel_words AS SELECT * FROM words_${threadId} WHERE message_id IN (SELECT message_id FROM sel)`);
        if (!cancelled) setReady(threadId);
      })
      .catch((e: unknown) => console.error('Word index failed', e));
    return () => {
      cancelled = true;
    };
  }, [threadId]);
  return ready === threadId;
}

// --- Per-viewer word exclusions (a convenience, so browser storage is fine) ---

const KEY = 'msgs.v2.excludedWords';
const listeners = new Set<() => void>();
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    cache = [];
  }
  return cache!;
}

function write(words: string[]) {
  cache = words;
  try {
    localStorage.setItem(KEY, JSON.stringify(words));
  } catch {
    // storage unavailable: keep the in-memory list for this session
  }
  listeners.forEach((l) => l());
}

export function useExcludedWords(): [string[], (words: string[]) => void] {
  const words = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    read,
  );
  return [words, write];
}

/** Predicate on a word column: not a stopword (if hiding them) and not excluded. */
export function wordFilterSql(col: string, hideCommon: boolean, excluded: string[]): string {
  const parts = [`length(${col}) > 1`];
  if (hideCommon) parts.push(`${col} NOT IN (SELECT w FROM stopwords)`);
  if (excluded.length) parts.push(`${col} NOT IN (${excluded.map(lit).join(', ')})`);
  return parts.join(' AND ');
}
