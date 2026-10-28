// Messages: the full conversation as a virtualised reader, with search
// (filter to matches, or highlight them in context and step through),
// jump to a date or a message, and a monthly density strip to navigate.
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Link2, Phone, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useConversation } from '../app/ConversationProvider';
import { searchRegExp, useReader, type ReaderMsg, type Search as SearchQuery, type SearchMode } from '../app/reader';
import { fmtInt } from '../lib/format';
import { fmtDuration, MONTHS } from '../lib/time';
import { AttachmentStrip } from '../media/AttachmentStrip';
import { Segmented } from '../ui/primitives';
import { Badge } from '../ui/Badge';

const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
const dayKey = (ms: number) => Math.floor(ms / 86_400_000);
/** A new sender block starts after this gap even when the sender is unchanged. */
const BLOCK_GAP = 10 * 60_000;

const isTyping = (e: KeyboardEvent) => e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]');

function Highlight({ text, re }: { text: string; re: RegExp | null }) {
  if (!re) return <>{text}</>;
  const out: ReactNode[] = [];
  let last = 0;
  re.lastIndex = 0;
  for (const m of text.matchAll(re)) {
    if (!m[0]) break;
    out.push(text.slice(last, m.index), <mark key={m.index} className="rounded-sm bg-accent/30 px-0.5 text-ink">{m[0]}</mark>);
    last = m.index! + m[0].length;
  }
  out.push(text.slice(last));
  return <>{out}</>;
}

function Body({ m, re }: { m: ReaderMsg; re: RegExp | null }) {
  const muted = 'italic text-ink-3';
  if (m.kind === 'call') {
    return <span className={muted}><Phone size={12} className="mr-1 inline align-[-1px]" />{m.call_missed ? 'Missed call' : `Call · ${fmtDuration((m.call_duration ?? 0) * 1000)}`}</span>;
  }
  if (m.kind === 'unsent') return <span className={muted}>Message unsent</span>;
  if (m.kind === 'other') return <span className={muted}>Empty message (no content in the export)</span>;
  return (
    <>
      {m.text && <span className="whitespace-pre-wrap break-words"><Highlight text={m.text} re={re} /></span>}
      {m.link && m.link !== m.text && (
        <a href={m.link} target="_blank" rel="noreferrer noopener" className="ml-1 inline-flex max-w-full items-center gap-1 truncate align-bottom text-accent hover:underline">
          <Link2 size={12} className="shrink-0" />
          <span className="truncate"><Highlight text={m.link} re={re} /></span>
        </a>
      )}
      <AttachmentStrip message={m} attachments={m.attachments} size={128} />
    </>
  );
}

function Reactions({ list }: { list: { a: string; e: string }[] }) {
  if (!list.length) return null;
  const by = new Map<string, string[]>();
  for (const r of list) by.set(r.e, [...(by.get(r.e) ?? []), r.a]);
  return (
    <div className="mt-0.5 flex flex-wrap gap-1">
      {[...by].map(([e, who]) => (
        <span key={e} title={who.join(', ')} className="inline-flex h-5 items-center gap-1 rounded-full border border-line bg-surface px-1.5 text-[12px]">
          {e}{who.length > 1 && <span className="num text-[10px] text-ink-3">{who.length}</span>}
        </span>
      ))}
    </div>
  );
}

function Row({ m, prev, re, focused, onlyMatches, onContext }: {
  m: ReaderMsg; prev: ReaderMsg | undefined; re: RegExp | null; focused: boolean; onlyMatches: boolean; onContext: () => void;
}) {

  const newDay = !prev || dayKey(prev.ts) !== dayKey(m.ts);
  const newBlock = newDay || !prev || prev.sender !== m.sender || m.ts - prev.ts > BLOCK_GAP;
  return (
    <div className="px-4">
      {newDay && (
        <div className="flex items-center gap-3 pb-1 pt-4 text-[11px] font-medium text-ink-3">
          <span className="h-px flex-1 bg-line" />
          {dayFmt.format(new Date(m.ts))}
          <span className="h-px flex-1 bg-line" />
        </div>
      )}
      <div className={`group grid grid-cols-[3rem_10rem_1fr_auto] gap-x-3 rounded px-2 py-[3px] ${newBlock ? 'mt-1.5' : ''} ${focused ? 'bg-accent-soft ring-1 ring-accent/40' : m.hit && !onlyMatches ? 'bg-accent-soft/50' : 'hover:bg-surface-2'}`}>
        <span className="num pt-px text-right text-[11px] text-ink-3">{timeFmt.format(new Date(m.ts))}</span>
        <span className="flex min-w-0 items-start gap-1.5 pt-px">
          {newBlock && (
            <>
              <Badge name={m.sender} />
              <span className="truncate text-[12px] font-medium">{m.sender}</span>
            </>
          )}
        </span>
        <div className="min-w-0">
          <Body m={m} re={re} />
          <Reactions list={m.reactions} />
        </div>
        <span className="invisible flex items-start gap-1 group-hover:visible">
          {onlyMatches && (
            <button onClick={onContext} className="rounded px-1.5 text-[11px] text-accent hover:bg-surface">show in context</button>
          )}
          <button
            title="Copy a link to this message"
            onClick={() => {
              const u = new URL(location.href);
              u.hash = u.hash.replace(/[?&]at=\d+/, '') + `${u.hash.includes('?') ? '&' : '?'}at=${m.message_id}`;
              void navigator.clipboard?.writeText(u.toString());
            }}
            className="rounded p-0.5 text-ink-3 hover:bg-surface hover:text-ink"
          >
            <Link2 size={12} />
          </button>
        </span>
      </div>
    </div>
  );
}

function Placeholder() {
  return (
    <div className="grid grid-cols-[3rem_10rem_1fr] gap-x-3 px-6 py-1.5">
      <span className="h-3 rounded bg-surface-2" />
      <span className="h-3 w-24 rounded bg-surface-2" />
      <span className="h-3 w-2/3 rounded bg-surface-2" />
    </div>
  );
}

/** Messages per month as a strip of bars; the band shows what is on screen. */
function DensityRail({ months, view, hits, onJump }: {
  months: { b: number; n: number; first: number }[]; view: [number, number]; hits: number[] | null; onJump: (rn: number) => void;
}) {
  const max = Math.max(1, ...months.map((m) => m.n));
  // Matches per month, for the marker row when highlighting in context.
  const hitCounts = useMemo(() => {
    if (!hits?.length) return null;
    const out = new Array(months.length).fill(0);
    let mi = 0;
    for (const rn of hits) {
      while (mi < months.length - 1 && months[mi + 1].first <= rn) mi++;
      out[mi]++;
    }
    return out;
  }, [hits, months]);
  const maxHits = hitCounts ? Math.max(1, ...hitCounts) : 1;
  const label = (b: number) => { const d = new Date(b); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
  const inView = (i: number) => {
    const end = months[i + 1]?.first ?? Infinity;
    return months[i].first <= view[1] && end > view[0];
  };
  // One label per year, skipping any that would crowd the previous one.
  const years: { y: number; i: number }[] = [];
  months.forEach((m, i) => {
    const y = new Date(m.b).getUTCFullYear();
    const prev = years[years.length - 1];
    if (prev?.y === y) return;
    if (!prev || (i - prev.i) / months.length > 0.035) years.push({ y, i });
  });
  return (
    <div className="shrink-0 border-b border-line bg-surface px-4 pb-1 pt-2">
      {hitCounts && (
        <div className="mb-0.5 flex h-1.5 gap-px" title="Where the matches are">
          {hitCounts.map((n, i) => (
            <span key={i} className="min-w-px flex-1 rounded-full" style={{ background: n ? 'var(--color-accent)' : 'transparent', opacity: n ? 0.35 + 0.65 * (n / maxHits) : 0 }} />
          ))}
        </div>
      )}
      <div className="flex h-8 items-end gap-px">
        {months.map((m, i) => (
          <button
            key={m.b}
            title={`${label(m.b)} · ${fmtInt(m.n)} messages`}
            onClick={() => onJump(m.first)}
            className="group relative h-full min-w-px flex-1"
          >
            <span
              className={`absolute inset-x-0 bottom-0 rounded-t-[1px] ${inView(i) ? 'bg-accent' : 'bg-ink-3/40 group-hover:bg-ink-3'}`}
              style={{ height: `${Math.max(6, (m.n / max) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="relative mt-0.5 h-3 text-[10px] text-ink-3">
        {years.map(({ y, i }) => (
          <span key={y} className="num absolute" style={{ left: `${(i / months.length) * 100}%` }}>{y}</span>
        ))}
      </div>
    </div>
  );
}

export function Messages({ at }: { at?: number }) {
  const { epoch, conv } = useConversation();
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState<SearchQuery>({ q: '', mode: 'text' });
  const [onlyMatches, setOnlyMatches] = useState(false);
  const [hitIdx, setHitIdx] = useState(0);
  const [focus, setFocus] = useState<number | null>(null);
  const [jumpDate, setJumpDate] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const reader = useReader(epoch, search, onlyMatches);
  const re = useMemo(() => searchRegExp(search), [search]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const virtualizer = useVirtualizer({
    count: reader.total,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 30,
    overscan: 25,
  });
  const items = virtualizer.getVirtualItems();
  const first = items[0]?.index ?? 0;
  const last = items[items.length - 1]?.index ?? 0;

  useEffect(() => {
    if (reader.total) reader.ensure(Math.max(0, first - 1), Math.min(reader.total - 1, last + 1));
  }, [first, last, reader.total, reader.ensure]);

  const jump = (rn: number) => {
    setFocus(rn);
    reader.ensure(Math.max(0, rn - 40), Math.min(reader.total - 1, rn + 40));
    virtualizer.scrollToIndex(rn, { align: 'center' });
    // Rows measure themselves once rendered; settle again so the target stays centred.
    setTimeout(() => virtualizer.scrollToIndex(rn, { align: 'center' }), 120);
  };

  // After each rebuild: go to the requested message, the first match, or the latest message.
  const pendingAt = useRef<number | undefined>(at);
  useEffect(() => {
    pendingAt.current = at;
  }, [at]);
  useEffect(() => {
    if (reader.building || !reader.version) return;
    setNotice(null);
    (async () => {
      const target = pendingAt.current;
      if (target !== undefined) {
        pendingAt.current = undefined;
        const rn = await reader.positionOf(target);
        if (rn !== null) {
          const h = reader.hits?.indexOf(rn) ?? -1;
          if (h >= 0) setHitIdx(h);
          return jump(rn);
        }
        setNotice('That message is not in the current selection. Clear filters or search to see it.');
      }
      if (reader.hits?.length) {
        setHitIdx(0);
        return jump(reader.hits[0]);
      }
      if (reader.total) {
        setFocus(null);
        virtualizer.scrollToIndex(reader.total - 1, { align: 'end' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reader.version, reader.building]);

  const stepHit = (d: 1 | -1) => {
    if (!reader.hits?.length) return;
    const i = (hitIdx + d + reader.hits.length) % reader.hits.length;
    setHitIdx(i);
    jump(reader.hits[i]);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !isTyping(e)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = () => setSearch((s) => ({ ...s, q: draft }));
  const searching = !!search.q.trim();
  const topRow = reader.row(first);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface px-4">
        <label className="flex h-7 w-96 items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 focus-within:border-accent">
          <Search size={13} className="text-ink-3" />
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              if (draft === search.q && reader.hits?.length) stepHit(e.shiftKey ? -1 : 1);
              else submit();
            }}
            placeholder="Search messages…  ( / )"
            className="w-full bg-transparent outline-none"
          />
          {draft && (
            <button onClick={() => (setDraft(''), setSearch((s) => ({ ...s, q: '' })))} className="text-ink-3 hover:text-ink">
              <X size={13} />
            </button>
          )}
        </label>
        <Segmented value={search.mode} options={[['text', 'Text'], ['word', 'Whole word'], ['regex', 'Regex']] as [SearchMode, string][]} onChange={(mode) => setSearch({ q: draft, mode })} />
        <label className="flex items-center gap-1.5 text-[12px] text-ink-2">
          <input type="checkbox" checked={onlyMatches} onChange={(e) => setOnlyMatches(e.target.checked)} className="accent-[var(--color-accent)]" />
          Only matches
        </label>
        {searching && !onlyMatches && (
          <div className="flex items-center gap-1">
            <span className="num min-w-20 text-right text-[12px] text-ink-2">
              {reader.hits?.length ? `${fmtInt(hitIdx + 1)} / ${fmtInt(reader.hits.length)}` : 'no match'}
            </span>
            <button title="Previous match (⇧↵)" onClick={() => stepHit(-1)} className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"><ArrowUp size={14} /></button>
            <button title="Next match (↵)" onClick={() => stepHit(1)} className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"><ArrowDown size={14} /></button>
          </div>
        )}
        {searching && onlyMatches && <span className="num text-[12px] text-ink-2">{fmtInt(reader.total)} matches</span>}
        <div className="ml-auto flex items-center gap-1">
          <input
            type="date"
            value={jumpDate}
            min={new Date(conv.firstTs).toISOString().slice(0, 10)}
            max={new Date(conv.lastTs).toISOString().slice(0, 10)}
            onChange={async (e) => {
              setJumpDate(e.target.value);
              if (!e.target.value) return;
              const rn = await reader.positionAtDate(e.target.value);
              if (rn !== null) jump(rn);
            }}
            title="Jump to date"
            className="num h-7 rounded border border-line bg-surface-2 px-1.5 text-[12px]"
          />
          <button title="First message" onClick={() => jump(0)} className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"><ChevronsUp size={15} /></button>
          <button title="Latest message" onClick={() => jump(reader.total - 1)} className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"><ChevronsDown size={15} /></button>
        </div>
      </div>

      {searching && reader.bySender.length > 0 && (
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-line bg-surface px-4 py-1.5 text-[11px] [scrollbar-width:none]">
          <span className="shrink-0 text-ink-3">Matches by person:</span>
          {reader.bySender.slice(0, 12).map((s) => (
            <span key={s.sender} className="inline-flex shrink-0 items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5">
              <Badge name={s.sender} />
              {s.sender} <span className="num text-ink-3">{fmtInt(s.n)}</span>
            </span>
          ))}
        </div>
      )}

      {reader.months.length > 1 && <DensityRail months={reader.months} view={[first, last]} hits={reader.hits} onJump={jump} />}

      {(reader.error || notice) && (
        <div className="shrink-0 border-b border-line bg-surface px-4 py-2 font-mono text-[12px] text-danger">{reader.error ?? notice}</div>
      )}

      <div className="relative min-h-0 flex-1">
        {topRow && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-1.5">
            <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px] font-medium text-ink-2 shadow-sm">{dayFmt.format(new Date(topRow.ts))}</span>
          </div>
        )}
        <div ref={scrollRef} className={`h-full overflow-auto bg-bg transition-opacity ${reader.building ? 'opacity-50' : ''}`}>
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {items.map((v) => {
              const m = reader.row(v.index);
              return (
                <div key={v.key} data-index={v.index} ref={virtualizer.measureElement} style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${v.start}px)` }}>
                  {m ? (
                    <Row
                      m={m}
                      prev={reader.row(v.index - 1)}
                      re={re}
                      focused={focus === v.index}
                      onlyMatches={onlyMatches && searching}
                      onContext={() => {
                        pendingAt.current = m.message_id;
                        setOnlyMatches(false);
                      }}
                    />
                  ) : (
                    <Placeholder />
                  )}
                </div>
              );
            })}
          </div>
          {!reader.building && reader.total === 0 && <div className="p-8 text-center text-ink-3">{searching ? 'No message matches.' : 'No messages in this selection.'}</div>}
        </div>
      </div>
    </div>
  );
}
