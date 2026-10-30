// SQL building blocks for pairwise analysis, shared by People, Content and Wrapped.
//
// A reply is a message whose previous message (in the whole conversation,
// in time order) came from someone else, within the reply window. Its
// latency is the gap to that previous message: the last message of the
// other person's turn.
import { lit } from '../db/duckdb';
import type { Conversation } from './ConversationProvider';

export const REPLY_WINDOWS: [string, string][] = [['5', '5 min'], ['30', '30 min'], ['120', '2 h'], ['720', '12 h'], ['1440', '24 h']];

export function repliesCte(windowMin: number, from = 'span'): string {
  return `replies AS (
    SELECT * FROM (
      SELECT message_id, ts, sender, sender AS replier, lag(sender) OVER w AS target,
             epoch_ms(ts) - epoch_ms(lag(ts) OVER w) AS lat_ms
      FROM ${from} WINDOW w AS (ORDER BY ts, message_id)
    ) WHERE target IS NOT NULL AND replier <> target AND lat_ms <= ${windowMin * 60_000}
  )`;
}

/** Turns: maximal runs of consecutive messages by the same person. */
export const TURNS_CTE = `turns AS (
    SELECT sender, tid, count(*) AS n FROM (
      SELECT sender, sum(new_turn) OVER (ORDER BY ts, message_id ROWS UNBOUNDED PRECEDING) AS tid FROM (
        SELECT sender, ts, message_id,
               CASE WHEN sender IS DISTINCT FROM lag(sender) OVER (ORDER BY ts, message_id) THEN 1 ELSE 0 END AS new_turn
        FROM span
      )
    ) GROUP BY sender, tid
  )`;

/** Everyone who wrote, in colour-slot order. `fold` is kept for call sites and is the identity. */
export function matrixPeople(conv: Conversation) {
  return { names: conv.people.filter((p) => p.messages > 0).map((p) => p.name), fold: (col: string) => col };
}

/** SQL predicate for messages that are replies between a and b (either direction). */
export function replyPairWhere(windowMin: number, a: string, b: string): string {
  return `message_id IN (
    WITH ${repliesCte(windowMin)}
    SELECT message_id FROM replies
    WHERE (replier = ${lit(a)} AND target = ${lit(b)}) OR (replier = ${lit(b)} AND target = ${lit(a)})
  ) OR message_id IN (
    -- the messages being replied to, so the inspector shows both sides
    SELECT prev_id FROM (
      SELECT sender, lead(sender) OVER w AS next_sender, message_id AS prev_id,
             epoch_ms(lead(ts) OVER w) - epoch_ms(ts) AS gap
      FROM span WINDOW w AS (ORDER BY ts, message_id)
    ) WHERE gap <= ${windowMin * 60_000}
      AND ((sender = ${lit(a)} AND next_sender = ${lit(b)}) OR (sender = ${lit(b)} AND next_sender = ${lit(a)}))
  )`;
}
