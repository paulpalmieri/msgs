// The analytical schema. Raw Arrow tables from the parser land as raw_*;
// these statements turn them into the typed tables every view queries.
//
//   threads       one row per conversation, with message stats
//   participants  thread membership (thread_id, name)
//   messages      one row per message; `ts` is local wall-clock time
//   reactions     one row per reaction (message_id, actor, reaction)
//   attachments   one row per photo/video/gif/audio/file/sticker
//   people        everyone seen as participant or sender, with totals
//   meta          key/value: owner, imported_at, source, schema_version
import { lit } from './duckdb';

export const SCHEMA_VERSION = 2;

/** Tables persisted to OPFS and restored on load, in dependency order. */
export const PERSISTED_TABLES = ['meta', 'threads', 'participants', 'messages', 'reactions', 'attachments', 'people'] as const;

export function buildSchemaSQL(meta: Record<string, string | number | null>): string[] {
  const metaRows = Object.entries(meta)
    .map(([k, v]) => `(${lit(k)}, ${lit(v === null ? null : String(v))})`)
    .join(', ');
  return [
    `CREATE OR REPLACE TABLE meta (key VARCHAR PRIMARY KEY, value VARCHAR)`,
    `INSERT INTO meta VALUES ${metaRows}`,

    `CREATE OR REPLACE TABLE messages AS
     SELECT message_id::INTEGER          AS message_id,
            thread_id::INTEGER           AS thread_id,
            epoch_ms(ts_local_ms::BIGINT) AS ts,
            epoch_ms(ts_ms::BIGINT)       AS ts_utc,
            sender,
            is_me,
            kind,
            text,
            chars::INTEGER               AS chars,
            words::INTEGER               AS words,
            n_attachments::SMALLINT      AS n_attachments,
            link::VARCHAR                AS link,
            call_duration::INTEGER       AS call_duration,
            call_missed::BOOLEAN         AS call_missed,
            n_reactions::SMALLINT        AS n_reactions
     FROM raw_messages ORDER BY message_id`,

    `CREATE OR REPLACE TABLE threads AS
     SELECT t.thread_id::INTEGER AS thread_id,
            t.thread_key,
            NULLIF(t.title, '') AS title,
            t.category,
            t.platform,
            t.participant_count::INTEGER AS participant_count,
            t.participant_count > 2 AS is_group,
            t.is_still_participant,
            coalesce(s.messages, 0)::INTEGER AS messages,
            coalesce(s.my_messages, 0)::INTEGER AS my_messages,
            s.first_ts,
            s.last_ts
     FROM raw_threads t
     LEFT JOIN (
       SELECT thread_id, count(*) AS messages, count(*) FILTER (is_me) AS my_messages,
              min(ts) AS first_ts, max(ts) AS last_ts
       FROM messages WHERE kind <> 'system' GROUP BY thread_id
     ) s USING (thread_id)
     ORDER BY thread_id`,

    `CREATE OR REPLACE TABLE participants AS
     SELECT thread_id::INTEGER AS thread_id, name FROM raw_participants`,

    `CREATE OR REPLACE TABLE reactions AS
     SELECT message_id::INTEGER AS message_id, thread_id::INTEGER AS thread_id, actor, reaction,
            epoch_ms(ts_ms::BIGINT) AS ts_utc
     FROM raw_reactions`,

    `CREATE OR REPLACE TABLE attachments AS
     SELECT message_id::INTEGER AS message_id, thread_id::INTEGER AS thread_id, type, uri
     FROM raw_attachments`,

    `CREATE OR REPLACE TABLE people AS
     WITH sent AS (
       SELECT sender AS name, count(*) AS messages, count(DISTINCT thread_id) AS threads_active,
              min(ts) AS first_ts, max(ts) AS last_ts
       FROM messages WHERE kind <> 'system' GROUP BY sender
     ), member AS (
       SELECT name, count(DISTINCT thread_id) AS threads FROM participants GROUP BY name
     )
     SELECT coalesce(member.name, sent.name) AS name,
            coalesce(member.threads, 0)::INTEGER AS threads_member,
            coalesce(sent.threads_active, 0)::INTEGER AS threads_active,
            coalesce(sent.messages, 0)::INTEGER AS messages,
            sent.first_ts, sent.last_ts,
            coalesce(member.name, sent.name) = ${lit(String(meta.owner ?? ''))} AS is_me
     FROM member FULL JOIN sent ON member.name = sent.name
     ORDER BY messages DESC`,

    ...['threads', 'participants', 'messages', 'reactions', 'attachments'].map((t) => `DROP TABLE IF EXISTS raw_${t}`),
  ];
}
