# MSGS v2

Desktop explorer for a single Messenger conversation: volumes, rhythms, and the relations between the people in it. Runs entirely in the browser.

Import the whole export once, pick a conversation, then explore it through the sidebar sections. Every chart reads the same filters (date range, people, content type) from the filter bar, which live in the URL. Click a mark to read its messages in the inspector; drag on the timeline to filter dates. Keys: `⌘K` switch conversation, `1`–`9` sections, `Esc` close the inspector, `/` search messages, `↵` / `⇧↵` next / previous match.

```bash
cp .env.example .env.local   # optional: set MSGS_EXPORT_DIR for the "Load dev export" button
npm install
npm run dev
npm test                     # parser tests; also parses MSGS_EXPORT_DIR when set
```

## Pipeline

```
export folder ──▶ sources.ts       walk folders, keep only messages/*/*/message_N.json
              ──▶ parser.worker.ts parse, repair Facebook mojibake, merge chunks, classify
              ──▶ arrow.ts         columns → Arrow IPC (transferred, zero-copy)
              ──▶ DuckDB-WASM      raw_* tables → typed schema (db/schema.ts)
              ──▶ persist.ts       Parquet in OPFS; reloads restore in ~1 s
```

## Tables

| table | grain | notes |
|---|---|---|
| `messages` | message | `ts` is local wall-clock time, `ts_utc` UTC. `kind`: text, photo, video, gif, sticker, audio, file, link, call, unsent, system, other. `text` is null for auto captions ("X sent a photo.") and calls. |
| `threads` | conversation | `thread_key` is the export's `thread_path`; `is_group` = more than 2 participants |
| `participants` | thread × member | |
| `people` | person | participants and senders, with message totals; `is_me` marks the export owner |
| `reactions` | reaction | `ts_utc` only when the export has it |
| `attachments` | attachment | `uri` points inside the original export |
| `meta` | key/value | owner, source, imported_at, schema_version |

Inside a conversation, `app/ConversationProvider.tsx` maintains temp views that every section queries (and that the SQL section exposes):

| view | contents |
|---|---|
| `conv` | the conversation's non-system messages |
| `ctx` | `conv` + people / content-type filters, no date filter (timelines) |
| `sel` | `ctx` + date range: the current selection |
| `sel_reactions` | reactions on `sel` messages, with `receiver` and `actor` |
| `span` | `conv` + date range only: turn-taking needs every message in order, so people filters apply to results |
| `span_reactions` | reactions on `span` messages |

The Content section builds a word index for the open conversation on first use (`app/words.ts`): `words_<thread_id>` (one row per word of each text message, lower-cased, French elisions stripped), `sel_words` (its rows for messages in `sel`) and `stopwords`.

The Messages reader numbers the selection (optionally only search matches) into a `reader` temp table (`rn`, `message_id`, `ts`) and loads it in pages of 200 as the virtual list scrolls (`app/reader.ts`). `?at=<message_id>` in the URL opens it on a message; inspector rows link there.

In dev, `window.__msgs.run(sql)` queries the in-page database and queries over 300 ms are logged.

A reply is a message whose previous message came from someone else within the reply window (`app/relations.ts`); its latency is the gap between the two.

Everyone is charted individually. Each person gets a fixed colour per conversation (you are always first): the 8 validated palette hues, then the same hues one step darker and one step lighter (24 colours, all passing the dataviz validator in both themes; `charts/palette.ts`). Past 24 colours repeat, so every person also has an initials badge (`ui/Badge.tsx`), and charts that would turn into spaghetti with many people (per-person rhythms, reply speed, message length, rates by year) are person × value heatmaps instead.

Wrapped (`sections/wrapped/`) has a personal story (themed in the person's colour) and, for groups, a group story. Both read one year (or all time) through `wrapped_msgs` / `wrapped_reactions` views and ignore the filter bar. `wrapped/awards.ts` measures everyone with 20+ messages on 15 metrics: each award goes to its leader, and every member also gets a personal title (their best relative rank, preferring titles nobody holds yet). The final card can be saved as a PNG (`html-to-image`, rendered locally). Its fonts are bundled with `@fontsource-variable/*`, so nothing is fetched from a third party.

Bump `SCHEMA_VERSION` in `db/schema.ts` whenever the schema changes; saved datasets with another version ask for a re-import.
