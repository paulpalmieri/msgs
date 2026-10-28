// Media: every photo, video, GIF, sticker, voice note and file in the
// selection, as a virtualised gallery grouped by month. Files are read
// straight from the export folder; nothing is copied.
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useConversation } from '../app/ConversationProvider';
import { useQuery } from '../db/useQuery';
import { fmtInt } from '../lib/format';
import { MONTHS } from '../lib/time';
import { useLightbox, type MediaItem } from '../media/Lightbox';
import { MediaBanner } from '../media/MediaBanner';
import { Thumb, type MediaType } from '../media/Thumb';
import { Badge } from '../ui/Badge';
import { Segmented } from '../ui/primitives';

const TYPES: [MediaType, string][] = [['photo', 'Photos'], ['video', 'Videos'], ['gif', 'GIFs'], ['sticker', 'Stickers'], ['audio', 'Voice notes'], ['file', 'Files']];
type Sort = 'new' | 'old' | 'loved';
const TILE = 148;
// Stable empty list, so the row layout isn't recomputed on every render.
const NONE: MediaItem[] = [];
const GAP = 6;

type Row = { kind: 'header'; label: string; n: number } | { kind: 'tiles'; items: { item: MediaItem; index: number }[] };

export function Media() {
  const { filters, setFilters, inspect } = useConversation();
  const lightbox = useLightbox();
  const [types, setTypes] = useState<MediaType[]>(['photo', 'video', 'gif']);
  const [sort, setSort] = useState<Sort>('new');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const counts = useQuery<{ type: MediaType; n: number }>(`SELECT a.type, count(*) AS n FROM attachments a JOIN sel m USING (message_id) GROUP BY 1`).data ?? [];
  const sharers = useQuery<{ sender: string; n: number }>(
    types.length
      ? `SELECT m.sender, count(*) AS n FROM attachments a JOIN sel m USING (message_id) WHERE a.type IN (${types.map((t) => `'${t}'`).join(', ')}) GROUP BY 1 ORDER BY n DESC`
      : null,
  ).data ?? [];
  const q = useQuery<MediaItem>(
    types.length
      ? `SELECT a.message_id, a.type, a.uri, epoch_ms(m.ts) AS ts, m.sender, m.n_reactions, m.text
         FROM attachments a JOIN sel m USING (message_id)
         WHERE a.type IN (${types.map((t) => `'${t}'`).join(', ')})
         ORDER BY ${sort === 'loved' ? 'm.n_reactions DESC, m.ts DESC' : `m.ts ${sort === 'new' ? 'DESC' : 'ASC'}`}, a.uri`
      : null,
  );
  const items = (types.length && q.data) || NONE;

  const cols = Math.max(2, Math.floor((width - 32 + GAP) / (TILE + GAP)));
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const push = (group: { item: MediaItem; index: number }[]) => {
      for (let i = 0; i < group.length; i += cols) out.push({ kind: 'tiles', items: group.slice(i, i + cols) });
    };
    if (sort === 'loved') {
      push(items.map((item, index) => ({ item, index })));
      return out;
    }
    let key = '';
    let group: { item: MediaItem; index: number }[] = [];
    items.forEach((item, index) => {
      const d = new Date(item.ts);
      const k = `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
      if (k !== key) {
        if (group.length) push(group);
        out.push({ kind: 'header', label: k, n: 0 });
        key = k;
        group = [];
      }
      group.push({ item, index });
      (out.findLast((r) => r.kind === 'header') as { n: number }).n++;
    });
    if (group.length) push(group);
    return out;
  }, [items, cols, sort]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (rows[i].kind === 'header' ? 34 : TILE + GAP),
    overscan: 4,
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => virtualizer.measure(), [rows]);

  const toggle = (t: MediaType) => setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const countOf = (t: MediaType) => counts.find((c) => c.type === t)?.n ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2">
        <div className="flex flex-wrap gap-1">
          {TYPES.map(([t, label]) => (
            <button
              key={t}
              onClick={() => toggle(t)}
              className={`h-7 rounded-md border px-2.5 text-[12px] ${types.includes(t) ? 'border-accent/50 bg-accent-soft font-medium text-ink' : 'border-line text-ink-3 hover:text-ink'}`}
            >
              {label} <span className="num ml-1 text-[11px] text-ink-3">{fmtInt(countOf(t))}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-ink-3">{fmtInt(items.length)} shown</span>
          <Segmented value={sort} options={[['new', 'Newest'], ['old', 'Oldest'], ['loved', 'Most reacted']] as [Sort, string][]} onChange={setSort} />
        </div>
      </div>

      {sharers.length > 1 && (
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-line bg-surface px-4 py-1.5 text-[11px] [scrollbar-width:none]">
          <span className="shrink-0 text-ink-3">Shared by</span>
          {sharers.slice(0, 20).map((s) => (
            <button
              key={s.sender}
              title={`Only ${s.sender}`}
              onClick={() => setFilters({ ...filters, people: filters.people.length === 1 && filters.people[0] === s.sender ? [] : [s.sender] })}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 ${filters.people.includes(s.sender) ? 'bg-accent-soft' : 'bg-surface-2 hover:bg-line'}`}
            >
              <Badge name={s.sender} size={16} /> {s.sender.split(' ')[0]} <span className="num text-ink-3">{fmtInt(s.n)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="shrink-0 px-4 pt-3 empty:hidden"><MediaBanner /></div>

      <div ref={scrollRef} className={`min-h-0 flex-1 overflow-auto px-4 pb-4 transition-opacity ${q.loading ? 'opacity-50' : ''}`}>
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((v) => {
            const row = rows[v.index];
            return (
              <div key={v.key} style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${v.start}px)` }}>
                {row.kind === 'header' ? (
                  <div className="group flex h-[34px] items-end gap-2 pb-1.5">
                    <span className="text-[13px] font-semibold">{row.label}</span>
                    <span className="num text-[11px] text-ink-3">{fmtInt(row.n)}</span>
                    <button
                      onClick={() => {
                        const first = items.find((it) => { const d = new Date(it.ts); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` === row.label; });
                        if (!first) return;
                        const d = new Date(first.ts);
                        const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
                        const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
                        inspect({ title: `Media · ${row.label}`, where: `n_attachments > 0 AND ts >= TIMESTAMP '${new Date(start).toISOString()}' AND ts < TIMESTAMP '${new Date(end).toISOString()}'` });
                      }}
                      className="text-[11px] text-accent opacity-0 hover:underline group-hover:opacity-100"
                    >
                      read the messages
                    </button>
                  </div>
                ) : (
                  <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: GAP, paddingBottom: GAP }}>
                    {row.items.map(({ item, index }) => (
                      <div key={`${item.message_id}-${item.uri}`} className="relative" style={{ height: TILE }}>
                        <Thumb uri={item.uri} type={item.type} className="h-full w-full" onClick={() => lightbox.open(items, index)} />
                        <span className="pointer-events-none absolute left-1 top-1"><Badge name={item.sender} size={18} /></span>
                        {!!item.n_reactions && (
                          <span className="num pointer-events-none absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] font-semibold text-white">♥ {item.n_reactions}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {!q.loading && types.length > 0 && !items.length && <div className="p-8 text-center text-ink-3">No media in this selection.</div>}
        {!types.length && <div className="p-8 text-center text-ink-3">Pick at least one type above.</div>}
      </div>
    </div>
  );
}
