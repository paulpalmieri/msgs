// Everything below the shell is scoped to one conversation. This provider
// loads it, assigns each person a stable colour, and maintains the temp
// views every section queries:
//
//   conv           all non-system messages of the conversation
//   ctx            conv + people / content-type filters (no date filter;
//                  timelines use it so the brushed range keeps its context)
//   sel            ctx + date range: the current selection
//   sel_reactions  reactions on messages in sel, with receiver + reactor
//   span           conv + date range only. Turn-taking (who replies to whom)
//                  needs every message in order, so people / type filters
//                  are applied to its results instead of its rows.
//   span_reactions reactions on messages in span
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useChartTheme } from '../charts/theme';
import { getEngine, lit, query } from '../db/duckdb';
import { useData } from './DataProvider';
import { KIND_GROUPS, type Filters } from './router';

export interface Person {
  name: string;
  messages: number;
  member: boolean;
  isMe: boolean;
  /** Rank-order index into the person palette (you first); colours repeat past its length. */
  slot: number;
}

export interface Conversation {
  threadId: number;
  title: string;
  isGroup: boolean;
  participantCount: number;
  messages: number;
  firstTs: number;
  lastTs: number;
  people: Person[];
}

export interface Inspection {
  title: string;
  /** SQL predicate over the messages columns. */
  where: string;
  /** View to read from: `sel` by default; `ctx` ignores the date filter, `span` the people / type filters. */
  from?: 'sel' | 'ctx' | 'span';
}

interface Ctx {
  conv: Conversation;
  filters: Filters;
  setFilters: (f: Filters) => void;
  /** Bumps whenever the views change; part of every query's cache key. */
  epoch: number;
  colorOf: (name: string) => string;
  /** SQL expression for a charted series: the sender (everyone is charted individually). */
  seriesSql: string;
  /** Everyone who sent a message, in colour-slot order. */
  seriesNames: string[];
  /** SQL predicate selecting one series. */
  seriesWhere: (series: string) => string;
  inspection: Inspection | null;
  inspect: (i: Inspection | null) => void;
  /** Minutes within which a message from someone else counts as a reply. */
  replyWindow: number;
  setReplyWindow: (m: number) => void;
}

const ConversationContext = createContext<Ctx | null>(null);
/** -1 outside a conversation; inside, 0 until the views exist, then bumps on every change. */
export const QueryEpochContext = createContext(-1);

let viewQueue: Promise<void> = Promise.resolve();

/** WHERE clause for the active filters; `withDates` false gives the ctx view. */
export function filterSql(f: Filters, withDates: boolean): string {
  const parts = ['TRUE'];
  if (f.people.length) parts.push(`sender IN (${f.people.map(lit).join(', ')})`);
  if (f.kinds.length) parts.push(`kind IN (${f.kinds.flatMap((k) => KIND_GROUPS[k]).map(lit).join(', ')})`);
  if (withDates) parts.push(dateSql(f));
  return parts.join(' AND ');
}

export function dateSql(f: Filters): string {
  const parts = ['TRUE'];
  if (f.from) parts.push(`ts >= DATE ${lit(f.from)}`);
  if (f.to) parts.push(`ts < DATE ${lit(f.to)} + INTERVAL 1 DAY`);
  return parts.join(' AND ');
}

/** Restricts pairwise results (a, b columns) to the people filter: either side may match. */
export function pairPeopleSql(f: Filters, a: string, b: string): string {
  if (!f.people.length) return 'TRUE';
  const list = f.people.map(lit).join(', ');
  return `(${a} IN (${list}) OR ${b} IN (${list}))`;
}

async function loadConversation(threadId: number, owner: string | null): Promise<Conversation | null> {
  const [t] = await query<{ title: string; is_group: boolean; participant_count: number; messages: number; first_ts: number; last_ts: number }>(`
    SELECT coalesce(title, '(untitled)') AS title, is_group, participant_count, messages,
           epoch_ms(first_ts) AS first_ts, epoch_ms(last_ts) AS last_ts
    FROM threads WHERE thread_id = ${threadId}`);
  if (!t) return null;
  const rows = await query<{ name: string; messages: number; member: boolean }>(`
    WITH s AS (SELECT sender AS name, count(*) AS n FROM messages WHERE thread_id = ${threadId} AND kind <> 'system' GROUP BY 1),
         p AS (SELECT DISTINCT name FROM participants WHERE thread_id = ${threadId})
    SELECT coalesce(p.name, s.name) AS name, coalesce(s.n, 0) AS messages, p.name IS NOT NULL AS member
    FROM p FULL JOIN s ON p.name = s.name
    ORDER BY messages DESC, name`);
  // The owner always takes slot 0 so "you" is the same colour everywhere.
  const ordered = [...rows.filter((r) => r.name === owner), ...rows.filter((r) => r.name !== owner)];
  const people = ordered.map((r, slot) => ({ ...r, isMe: r.name === owner, slot }));
  return {
    threadId,
    title: t.title,
    isGroup: t.is_group,
    participantCount: t.participant_count,
    messages: t.messages,
    firstTs: t.first_ts,
    lastTs: t.last_ts,
    people,
  };
}

export function ConversationProvider({ threadId, filters, setFilters, children, fallback }: {
  threadId: number;
  filters: Filters;
  setFilters: (f: Filters) => void;
  children: ReactNode;
  fallback: (state: 'loading' | 'missing') => ReactNode;
}) {
  const { state } = useData();
  const owner = state.status === 'ready' ? state.info.owner : null;
  const version = state.status === 'ready' ? state.version : 0;
  const theme = useChartTheme();
  const [conv, setConv] = useState<Conversation | null | undefined>(undefined);
  const [epoch, setEpoch] = useState(0);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [replyWindow, setReplyWindow] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setConv(undefined);
    setEpoch(0);
    setInspection(null);
    loadConversation(threadId, owner).then((c) => !cancelled && setConv(c));
    return () => {
      cancelled = true;
    };
  }, [threadId, owner, version]);

  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    if (!conv) return;
    let cancelled = false;
    // Serialised so overlapping filter changes can't interleave their statements.
    viewQueue = viewQueue.then(async () => {
      const { conn } = await getEngine();
      await conn.query(`CREATE OR REPLACE TEMP VIEW conv AS SELECT * FROM messages WHERE thread_id = ${conv.threadId} AND kind <> 'system'`);
      await conn.query(`CREATE OR REPLACE TEMP VIEW ctx AS SELECT * FROM conv WHERE ${filterSql(filters, false)}`);
      await conn.query(`CREATE OR REPLACE TEMP VIEW sel AS SELECT * FROM ctx WHERE ${filterSql(filters, true)}`);
      await conn.query(`CREATE OR REPLACE TEMP VIEW sel_reactions AS
        SELECT r.message_id, r.actor, r.reaction, m.sender AS receiver, m.ts AS message_ts
        FROM reactions r JOIN sel m USING (message_id)`);
      await conn.query(`CREATE OR REPLACE TEMP VIEW span AS SELECT * FROM conv WHERE ${dateSql(filters)}`);
      await conn.query(`CREATE OR REPLACE TEMP VIEW span_reactions AS
        SELECT r.message_id, r.actor, r.reaction, m.sender AS receiver, m.ts AS message_ts
        FROM reactions r JOIN span m USING (message_id)`);
      if (!cancelled) setEpoch((e) => e + 1);
    }).catch((e: unknown) => console.error('Failed to build conversation views', e));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv, filterKey]);

  const colorOf = useCallback(
    (name: string) => {
      const p = conv?.people.find((x) => x.name === name);
      return p ? theme.people[p.slot % theme.people.length] : theme.muted;
    },
    [conv, theme],
  );

  const seriesNames = useMemo(() => (conv?.people ?? []).filter((p) => p.messages > 0).map((p) => p.name), [conv]);
  const seriesWhere = useCallback((s: string) => `sender = ${lit(s)}`, []);
  const seriesSql = 'sender';

  if (conv === undefined) return <>{fallback('loading')}</>;
  if (conv === null) return <>{fallback('missing')}</>;

  return (
    <ConversationContext.Provider value={{ conv, filters, setFilters, epoch, colorOf, seriesSql, seriesNames, seriesWhere, inspection, inspect: setInspection,
      // In groups a reply follows quickly; in a 1:1 an answer hours later is still an answer.
      replyWindow: replyWindow ?? (conv.isGroup ? 30 : 720), setReplyWindow }}>
      <QueryEpochContext.Provider value={epoch}>{children}</QueryEpochContext.Provider>
    </ConversationContext.Provider>
  );
}

export function useConversation(): Ctx {
  const ctx = useContext(ConversationContext);
  if (!ctx) throw new Error('useConversation outside ConversationProvider');
  return ctx;
}
