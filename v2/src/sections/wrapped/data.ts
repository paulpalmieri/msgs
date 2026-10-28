// Everything a Wrapped story needs, for one person (or the whole group) over
// one year or all time of the open conversation. It ignores the filter bar on
// purpose: a Wrapped is a fixed portrait, not an exploration.
//
//   wrapped_msgs       conv limited to the period
//   wrapped_reactions  reactions on those messages (actor, reaction, receiver)
import type { Conversation } from '../../app/ConversationProvider';
import { repliesCte } from '../../app/relations';
import { ensureStopwords, tokensSql } from '../../app/words';
import { getEngine, lit, query } from '../../db/duckdb';
import { loadMetrics, superlatives, winners, type Metrics, type Winner } from './awards';

const MEDIA_KINDS = ['photo', 'video', 'gif', 'audio', 'sticker', 'link', 'call'] as const;

export type Photo = { uri: string; type: 'photo' | 'gif'; n: number; ts: number; sender: string };

export interface Period {
  year: number | null;
  /** Per-day counts (a year) or per-month counts (all time), for the squares slide. */
  days: { d: number; n: number }[];
  monthly: number[];
  hourly: number[];
  /** The period's most reacted photos (and GIFs), for the collage slide. */
  photos: Photo[];
  photoCount: number;
}

export interface WrappedData extends Period {
  mode: 'person';
  person: string;
  conversation: string;
  isGroup: boolean;
  mine: number;
  total: number;
  senders: number;
  rank: number;
  other: { name: string; n: number } | null;
  words: number;
  busiestDay: { day: number; n: number } | null;
  received: number;
  receivedRate: number;
  convRate: number;
  given: number;
  topFan: { name: string; n: number } | null;
  favourite: { name: string; n: number } | null;
  emojisGiven: { e: string; n: number }[];
  /** The people they interacted with most: replies and reactions, both ways. */
  orbit: { name: string; score: number }[];
  sessionsStarted: number;
  starterRank: number;
  starters: number;
  streak: { days: number; from: number; to: number } | null;
  media: Record<(typeof MEDIA_KINDS)[number], number>;
  topWords: { w: string; n: number }[];
  bestMessage: { text: string | null; kind: string; n: number; emojis: string; ts: number; uri: string | null } | null;
  /** Their personal title, and any award they lead outright (groups). */
  title: Winner | null;
  won: Winner[];
}

export interface GroupWrapped extends Period {
  mode: 'group';
  conversation: string;
  total: number;
  senders: number;
  activeDays: number;
  words: number;
  podium: { name: string; n: number }[];
  busiestDay: { day: number; n: number; top: string } | null;
  bestMessage: { sender: string; text: string | null; kind: string; n: number; emojis: string; ts: number; uri: string | null } | null;
  duo: { a: string; b: string; n: number } | null;
  topWords: { w: string; n: number }[];
  topReactions: { e: string; n: number }[];
  winners: Winner[];
  /** Everyone's personal title, in message order. */
  titles: Winner[];
  metrics: Metrics[];
}

async function prepare(year: number | null) {
  const { conn } = await getEngine();
  await ensureStopwords();
  await conn.query(`CREATE OR REPLACE TEMP VIEW wrapped_msgs AS SELECT * FROM conv ${year ? `WHERE year(ts) = ${year}` : ''}`);
  await conn.query(`CREATE OR REPLACE TEMP VIEW wrapped_reactions AS
    SELECT r.actor, r.reaction, m.sender AS receiver, r.message_id FROM reactions r JOIN wrapped_msgs m USING (message_id)`);
}

async function period(year: number | null, who: string | null): Promise<Period> {
  const w = who ? `WHERE sender = ${lit(who)}` : '';
  const days = year
    ? await query<{ d: number; n: number }>(`SELECT epoch_ms(ts::DATE::TIMESTAMP) AS d, count(*) AS n FROM wrapped_msgs ${w} GROUP BY 1 ORDER BY 1`)
    : await query<{ d: number; n: number }>(`SELECT epoch_ms(date_trunc('month', ts)) AS d, count(*) AS n FROM wrapped_msgs ${w} GROUP BY 1 ORDER BY 1`);
  const dist = async (expr: string, size: number) => {
    const out = new Array(size).fill(0);
    for (const r of await query<{ k: number; n: number }>(`SELECT ${expr} AS k, count(*) AS n FROM wrapped_msgs ${w} GROUP BY 1`)) out[r.k] = r.n;
    return out;
  };
  const who2 = who ? `AND m.sender = ${lit(who)}` : '';
  const photos = await query<Photo>(`
    SELECT a.uri, a.type, m.n_reactions AS n, epoch_ms(m.ts) AS ts, m.sender
    FROM attachments a JOIN wrapped_msgs m USING (message_id)
    WHERE a.type IN ('photo', 'gif') ${who2}
    ORDER BY m.n_reactions DESC, m.ts DESC LIMIT 9`);
  const [pc] = await query<{ n: number }>(`SELECT count(*) AS n FROM attachments a JOIN wrapped_msgs m USING (message_id) WHERE a.type = 'photo' ${who2}`);
  return { year, days, monthly: await dist('month(ts) - 1', 12), hourly: await dist('hour(ts)', 24), photos, photoCount: pc?.n ?? 0 };
}

const topWordsSql = (who: string | null) => `
  SELECT w, count(*) AS n FROM (SELECT unnest(${tokensSql('text')}) AS w FROM wrapped_msgs WHERE kind = 'text' ${who ? `AND sender = ${lit(who)}` : ''})
  WHERE length(w) > 2 AND w NOT IN (SELECT w FROM stopwords) GROUP BY 1 ORDER BY n DESC LIMIT 5`;

export async function loadWrapped(conv: Conversation, person: string, year: number | null): Promise<WrappedData> {
  await prepare(year);
  const P = lit(person);

  const ranks = await query<{ sender: string; n: number; r: number }>(`
    SELECT sender, count(*) AS n, rank() OVER (ORDER BY count(*) DESC) AS r FROM wrapped_msgs GROUP BY 1 ORDER BY n DESC`);
  const me = ranks.find((r) => r.sender === person);
  const total = ranks.reduce((a, r) => a + r.n, 0);
  const other = conv.isGroup ? null : ranks.find((r) => r.sender !== person) ?? null;

  const [basics] = await query<{ words: number } & Record<(typeof MEDIA_KINDS)[number], number>>(`
    SELECT coalesce(sum(words), 0) AS words, ${MEDIA_KINDS.map((k) => `count(*) FILTER (kind = '${k}') AS ${k}`).join(', ')}
    FROM wrapped_msgs WHERE sender = ${P}`);
  const [busiest] = await query<{ day: number; n: number }>(`
    SELECT epoch_ms(ts::DATE::TIMESTAMP) AS day, count(*) AS n FROM wrapped_msgs WHERE sender = ${P} GROUP BY 1 ORDER BY n DESC LIMIT 1`);

  const [rx] = await query<{ received: number; given: number; all_r: number }>(`
    SELECT count(*) FILTER (receiver = ${P}) AS received, count(*) FILTER (actor = ${P}) AS given, count(*) AS all_r FROM wrapped_reactions`);
  const [topFan] = await query<{ name: string; n: number }>(`
    SELECT actor AS name, count(*) AS n FROM wrapped_reactions WHERE receiver = ${P} AND actor <> ${P} GROUP BY 1 ORDER BY n DESC LIMIT 1`);
  const [favourite] = await query<{ name: string; n: number }>(`
    SELECT receiver AS name, count(*) AS n FROM wrapped_reactions WHERE actor = ${P} AND receiver <> ${P} GROUP BY 1 ORDER BY n DESC LIMIT 1`);
  const emojisGiven = await query<{ e: string; n: number }>(`
    SELECT reaction AS e, count(*) AS n FROM wrapped_reactions WHERE actor = ${P} GROUP BY 1 ORDER BY n DESC LIMIT 5`);

  const orbit = await query<{ name: string; score: number }>(`
    WITH ${repliesCte(conv.isGroup ? 30 : 720, 'wrapped_msgs')}
    SELECT name, count(*) AS score FROM (
      SELECT target AS name FROM replies WHERE replier = ${P}
      UNION ALL SELECT replier FROM replies WHERE target = ${P}
      UNION ALL SELECT receiver FROM wrapped_reactions WHERE actor = ${P} AND receiver <> ${P}
      UNION ALL SELECT actor FROM wrapped_reactions WHERE receiver = ${P} AND actor <> ${P}
    ) GROUP BY 1 ORDER BY score DESC LIMIT 6`);

  const starters = await query<{ sender: string; n: number }>(`
    SELECT sender, count(*) AS n FROM (
      SELECT sender, ts - lag(ts) OVER (ORDER BY ts, message_id) AS gap FROM wrapped_msgs
    ) WHERE gap IS NULL OR gap > INTERVAL 2 HOUR GROUP BY 1 ORDER BY n DESC`);
  const starterIdx = starters.findIndex((s) => s.sender === person);

  const [streak] = await query<{ days: number; from_ms: number; to_ms: number }>(`
    WITH d AS (SELECT DISTINCT ts::DATE AS d FROM wrapped_msgs WHERE sender = ${P}),
    g AS (SELECT d, d - CAST(row_number() OVER (ORDER BY d) AS INTEGER) AS grp FROM d)
    SELECT count(*) AS days, epoch_ms(min(d)::TIMESTAMP) AS from_ms, epoch_ms(max(d)::TIMESTAMP) AS to_ms
    FROM g GROUP BY grp ORDER BY days DESC LIMIT 1`);

  const [best] = await query<{ text: string | null; kind: string; n: number; emojis: string; ts: number; uri: string | null }>(`
    SELECT m.text, m.kind, count(*) AS n, string_agg(r.reaction, '') AS emojis, epoch_ms(m.ts) AS ts,
           (SELECT min(uri) FROM attachments a WHERE a.message_id = m.message_id AND a.type IN ('photo', 'gif')) AS uri
    FROM wrapped_msgs m JOIN reactions r USING (message_id) WHERE m.sender = ${P}
    GROUP BY m.message_id, m.text, m.kind, m.ts ORDER BY n DESC, m.ts DESC LIMIT 1`);

  let title: Winner | null = null;
  let won: Winner[] = [];
  if (conv.isGroup) {
    const metrics = await loadMetrics();
    title = superlatives(metrics).get(person) ?? null;
    won = winners(metrics).filter((w) => w.name === person);
  }

  const mine = me?.n ?? 0;
  return {
    mode: 'person',
    ...(await period(year, person)),
    person,
    conversation: conv.title,
    isGroup: conv.isGroup,
    mine,
    total,
    senders: ranks.length,
    rank: me?.r ?? ranks.length,
    other: other ? { name: other.sender, n: other.n } : null,
    words: basics?.words ?? 0,
    busiestDay: busiest ?? null,
    received: rx?.received ?? 0,
    receivedRate: mine ? ((rx?.received ?? 0) / mine) * 100 : 0,
    convRate: total ? ((rx?.all_r ?? 0) / total) * 100 : 0,
    given: rx?.given ?? 0,
    topFan: topFan ?? null,
    favourite: favourite ?? null,
    emojisGiven,
    orbit,
    sessionsStarted: starters[starterIdx]?.n ?? 0,
    starterRank: starterIdx + 1,
    starters: starters.length,
    streak: streak ? { days: streak.days, from: streak.from_ms, to: streak.to_ms } : null,
    media: Object.fromEntries(MEDIA_KINDS.map((k) => [k, basics?.[k] ?? 0])) as WrappedData['media'],
    topWords: await query<{ w: string; n: number }>(topWordsSql(person)),
    bestMessage: best ?? null,
    title,
    won,
  };
}

export async function loadGroupWrapped(conv: Conversation, year: number | null): Promise<GroupWrapped> {
  await prepare(year);
  const [k] = await query<{ total: number; senders: number; days: number; words: number }>(`
    SELECT count(*) AS total, count(DISTINCT sender) AS senders, count(DISTINCT ts::DATE) AS days, coalesce(sum(words), 0) AS words FROM wrapped_msgs`);
  const podium = await query<{ name: string; n: number }>(`SELECT sender AS name, count(*) AS n FROM wrapped_msgs GROUP BY 1 ORDER BY n DESC LIMIT 3`);
  const [busiest] = await query<{ day: number; n: number; top: string }>(`
    SELECT epoch_ms(ts::DATE::TIMESTAMP) AS day, count(*) AS n, mode(sender) AS top FROM wrapped_msgs GROUP BY 1 ORDER BY n DESC LIMIT 1`);
  const [best] = await query<{ sender: string; text: string | null; kind: string; n: number; emojis: string; ts: number; uri: string | null }>(`
    SELECT m.sender, m.text, m.kind, count(*) AS n, string_agg(r.reaction, '') AS emojis, epoch_ms(m.ts) AS ts,
           (SELECT min(uri) FROM attachments a WHERE a.message_id = m.message_id AND a.type IN ('photo', 'gif')) AS uri
    FROM wrapped_msgs m JOIN reactions r USING (message_id)
    GROUP BY m.message_id, m.sender, m.text, m.kind, m.ts ORDER BY n DESC, m.ts DESC LIMIT 1`);
  const [duo] = await query<{ a: string; b: string; n: number }>(`
    WITH ${repliesCte(30, 'wrapped_msgs')}
    SELECT least(replier, target) AS a, greatest(replier, target) AS b, count(*) AS n FROM replies GROUP BY 1, 2 ORDER BY n DESC LIMIT 1`);
  const topReactions = await query<{ e: string; n: number }>(`SELECT reaction AS e, count(*) AS n FROM wrapped_reactions GROUP BY 1 ORDER BY n DESC LIMIT 5`);
  const metrics = await loadMetrics();
  const titles = superlatives(metrics);
  return {
    mode: 'group',
    ...(await period(year, null)),
    conversation: conv.title,
    total: k?.total ?? 0,
    senders: k?.senders ?? 0,
    activeDays: k?.days ?? 0,
    words: k?.words ?? 0,
    podium,
    busiestDay: busiest ?? null,
    bestMessage: best ?? null,
    duo: duo ?? null,
    topWords: await query<{ w: string; n: number }>(topWordsSql(null)),
    topReactions,
    winners: winners(metrics),
    titles: metrics.map((m) => titles.get(m.name)).filter((w): w is Winner => !!w),
    metrics,
  };
}

export type Chronotype = { name: string; line: string; hours: string };

/** Which part of the day the person over-indexes on. */
export function chronotype(hourly: number[]): Chronotype {
  const total = hourly.reduce((a, b) => a + b, 0) || 1;
  const share = (from: number, to: number) => {
    let n = 0;
    for (let h = from; h !== to; h = (h + 1) % 24) n += hourly[h];
    return n / total;
  };
  const night = share(23, 5);
  const morning = share(5, 11);
  const day = share(11, 18);
  const evening = share(18, 23);
  if (night >= 0.2) return { name: 'Night Owl', line: `${Math.round(night * 100)}% of messages after 11 pm`, hours: '23h–5h' };
  const best = [
    { name: 'Early Bird', v: morning, hours: '5h–11h' },
    { name: 'Daytime Talker', v: day, hours: '11h–18h' },
    { name: 'Evening Person', v: evening, hours: '18h–23h' },
  ].sort((a, b) => b.v - a.v)[0];
  return { name: best.name, line: `${Math.round(best.v * 100)}% of messages between ${best.hours}`, hours: best.hours };
}
