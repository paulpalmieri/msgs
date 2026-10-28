// Superlatives. Every person gets measured on the same metrics; each award
// goes to its leader, and every member also gets their own title: the
// metric where they rank best relative to the group (preferring titles
// nobody else holds yet), so nobody is left out.
import { repliesCte } from '../../app/relations';
import { query } from '../../db/duckdb';

export interface Metrics {
  name: string;
  n: number;
  [metric: string]: number | string;
}

export interface Award {
  id: string;
  title: string;
  emoji: string;
  /** What the number means, e.g. "words per message". */
  unit: string;
  /** Higher wins unless `lowWins`. */
  lowWins?: boolean;
  format: (v: number) => string;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const one = (v: number) => v.toFixed(1);
const int = (v: number) => Math.round(v).toLocaleString('en-US');
const dur = (ms: number) => (ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60_000)} min`);

export const AWARDS: Award[] = [
  { id: 'n', title: 'The Chatterbox', emoji: '🗣️', unit: 'messages', format: int },
  { id: 'avg_words', title: 'The Novelist', emoji: '📜', unit: 'words per message', format: one },
  { id: 'got_rate', title: 'The Crowd Pleaser', emoji: '🌟', unit: 'reactions per 100 messages', format: one },
  { id: 'given_rate', title: 'The Hype Person', emoji: '📣', unit: 'reactions given per 100 messages', format: one },
  { id: 'reply_ms', title: 'The Speed Demon', emoji: '⚡', unit: 'median reply', lowWins: true, format: dur },
  { id: 'starts', title: 'The Icebreaker', emoji: '🧊', unit: 'silences broken', format: int },
  { id: 'last_words', title: 'The Last Word', emoji: '🎤', unit: 'conversations ended', format: int },
  { id: 'doubles', title: 'The Double Texter', emoji: '✌️', unit: 'of turns are 2+ messages', format: pct },
  { id: 'night', title: 'The Night Owl', emoji: '🦉', unit: 'of messages after 11 pm', format: pct },
  { id: 'early', title: 'The Early Bird', emoji: '🐦', unit: 'of messages before 9 am', format: pct },
  { id: 'media', title: 'The Photographer', emoji: '📸', unit: 'photos & videos', format: int },
  { id: 'links', title: 'The Curator', emoji: '🔗', unit: 'links shared', format: int },
  { id: 'emoji_rate', title: 'The Emoji Artist', emoji: '🎨', unit: 'emoji per 100 messages', format: one },
  { id: 'questions', title: 'The Curious One', emoji: '❓', unit: 'of messages are questions', format: pct },
  { id: 'calls', title: 'The Caller', emoji: '📞', unit: 'calls', format: int },
];

const EMOJI_RE = `[\\x{1F300}-\\x{1F3FA}\\x{1F400}-\\x{1FAFF}\\x{2600}-\\x{27BF}]`;

/** Metrics for everyone with at least `min` messages in `wrapped_msgs` (see data.ts). */
export async function loadMetrics(min = 20): Promise<Metrics[]> {
  const rows = await query<Metrics>(`
    WITH m AS (SELECT * FROM wrapped_msgs),
    base AS (
      SELECT sender AS name, count(*) AS n,
             coalesce(avg(words) FILTER (kind = 'text'), 0) AS avg_words,
             count(*) FILTER (hour(ts) >= 23 OR hour(ts) < 5) / count(*) AS night,
             count(*) FILTER (hour(ts) >= 5 AND hour(ts) < 9) / count(*) AS early,
             count(*) FILTER (kind IN ('photo', 'video')) AS media,
             count(*) FILTER (kind = 'link') AS links,
             count(*) FILTER (kind = 'call') AS calls,
             count(*) FILTER (kind = 'text' AND trim(text) LIKE '%?') / greatest(1, count(*) FILTER (kind = 'text')) AS questions,
             coalesce(sum(len(regexp_extract_all(text, '${EMOJI_RE}'))), 0) * 100.0 / count(*) AS emoji_rate,
             coalesce(sum(n_reactions), 0) * 100.0 / count(*) AS got_rate
      FROM m GROUP BY 1 HAVING count(*) >= ${min}
    ),
    given AS (SELECT actor AS name, count(*) AS g FROM wrapped_reactions GROUP BY 1),
    ${repliesCte(30, 'm')},
    rep AS (SELECT replier AS name, median(lat_ms) AS reply_ms FROM replies GROUP BY 1 HAVING count(*) >= 10),
    gaps AS (
      SELECT sender, lead(sender) OVER w AS next_sender,
             ts - lag(ts) OVER w AS before, lead(ts) OVER w - ts AS after
      FROM m WINDOW w AS (ORDER BY ts, message_id)
    ),
    starts AS (SELECT sender AS name, count(*) AS starts FROM gaps WHERE before IS NULL OR before > INTERVAL 2 HOUR GROUP BY 1),
    ends AS (SELECT sender AS name, count(*) AS last_words FROM gaps WHERE after IS NULL OR after > INTERVAL 2 HOUR GROUP BY 1),
    turns AS (
      SELECT sender AS name, count(*) FILTER (k >= 2) / count(*) AS doubles FROM (
        SELECT sender, tid, count(*) AS k FROM (
          SELECT sender, sum(nt) OVER (ORDER BY ts, message_id ROWS UNBOUNDED PRECEDING) AS tid FROM (
            SELECT sender, ts, message_id, CASE WHEN sender IS DISTINCT FROM lag(sender) OVER (ORDER BY ts, message_id) THEN 1 ELSE 0 END AS nt FROM m
          )
        ) GROUP BY 1, 2
      ) GROUP BY 1
    )
    SELECT base.*, coalesce(given.g, 0) * 100.0 / base.n AS given_rate, rep.reply_ms,
           coalesce(starts.starts, 0) AS starts, coalesce(ends.last_words, 0) AS last_words, coalesce(turns.doubles, 0) AS doubles
    FROM base LEFT JOIN given USING (name) LEFT JOIN rep USING (name) LEFT JOIN starts USING (name)
              LEFT JOIN ends USING (name) LEFT JOIN turns USING (name)
    ORDER BY n DESC`);
  return rows;
}

export interface Winner {
  award: Award;
  name: string;
  value: number;
}

/** The leader of each award (skipping awards nobody scores on). */
export function winners(metrics: Metrics[]): Winner[] {
  const out: Winner[] = [];
  for (const a of AWARDS) {
    const scored = metrics.filter((m) => typeof m[a.id] === 'number' && (m[a.id] as number) > 0);
    if (!scored.length) continue;
    const best = scored.reduce((b, m) => ((a.lowWins ? (m[a.id] as number) < (b[a.id] as number) : (m[a.id] as number) > (b[a.id] as number)) ? m : b));
    out.push({ award: a, name: best.name, value: best[a.id] as number });
  }
  return out;
}

/**
 * One title per person: the award where they rank best among the group
 * (percentile), preferring awards not yet given to someone else.
 */
export function superlatives(metrics: Metrics[]): Map<string, Winner> {
  const ranks = new Map<string, Map<string, number>>();
  for (const a of AWARDS) {
    const scored = metrics.filter((m) => typeof m[a.id] === 'number' && (m[a.id] as number) > 0);
    const sorted = [...scored].sort((x, y) => (a.lowWins ? 1 : -1) * ((x[a.id] as number) - (y[a.id] as number)));
    sorted.forEach((m, i) => {
      if (!ranks.has(m.name)) ranks.set(m.name, new Map());
      ranks.get(m.name)!.set(a.id, sorted.length > 1 ? i / (sorted.length - 1) : 0);
    });
  }
  const used = new Map<string, number>();
  const out = new Map<string, Winner>();
  // Strongest people choose first, so leaders keep their headline award.
  for (const m of metrics) {
    const mine = ranks.get(m.name);
    if (!mine?.size) continue;
    const options = AWARDS.filter((a) => mine.has(a.id))
      .map((a) => ({ a, score: mine.get(a.id)! + 0.35 * (used.get(a.id) ?? 0) }))
      .sort((x, y) => x.score - y.score);
    const pick = options[0].a;
    used.set(pick.id, (used.get(pick.id) ?? 0) + 1);
    out.set(m.name, { award: pick, name: m.name, value: m[pick.id] as number });
  }
  return out;
}
