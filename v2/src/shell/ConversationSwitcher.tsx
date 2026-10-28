// ⌘K palette to jump to another conversation without leaving the section.
import { Search, User, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useConversations, type ConversationRow } from '../db/useConversations';
import { fmtDate, fmtInt } from '../lib/format';

export function ConversationSwitcher({ onPick, onClose }: { onPick: (r: ConversationRow) => void; onClose: () => void }) {
  const { rows } = useConversations();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !needle || r.title.toLowerCase().includes(needle)).slice(0, 100);
  }, [rows, q]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]" onMouseDown={onClose}>
      <div className="w-[560px] overflow-hidden rounded-xl border border-line bg-surface shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <label className="flex h-11 items-center gap-2 border-b border-line px-3">
          <Search size={15} className="text-ink-3" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to conversation…"
            className="w-full bg-transparent text-[14px] outline-none"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(a + 1, matches.length - 1)));
              else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(a - 1, 0)));
              else if (e.key === 'Enter' && matches[active]) onPick(matches[active]);
              else if (e.key === 'Escape') onClose();
            }}
          />
          <kbd className="rounded border border-line px-1.5 text-[10px] text-ink-3">esc</kbd>
        </label>
        <div ref={listRef} className="max-h-[50vh] overflow-auto py-1">
          {matches.map((r, i) => (
            <button
              key={r.thread_id}
              data-i={i}
              onMouseEnter={() => setActive(i)}
              onClick={() => onPick(r)}
              className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left ${i === active ? 'bg-accent-soft' : ''}`}
            >
              {r.is_group ? <Users size={14} className="shrink-0 text-ink-3" /> : <User size={14} className="shrink-0 text-ink-3" />}
              <span className="min-w-0 flex-1 truncate">{r.title}</span>
              <span className="num shrink-0 text-[11px] text-ink-3">
                {fmtInt(r.messages)} · {fmtDate(r.last_ts)}
              </span>
            </button>
          ))}
          {rows && !matches.length && <div className="px-3 py-4 text-ink-3">No conversation matches.</div>}
        </div>
      </div>
    </div>
  );
}
