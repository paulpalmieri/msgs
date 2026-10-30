// One row of filters above every section. All of it lives in the URL.
import { Calendar, Check, ChevronDown, Search, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useConversation } from '../app/ConversationProvider';
import { KIND_GROUPS, NO_FILTERS, type Filters, type KindGroup, type Section } from '../app/router';
import { useQuery } from '../db/useQuery';
import { fmtInt } from '../lib/format';
import { Popover } from '../ui/Popover';
import { Badge } from '../ui/Badge';

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => day(Date.parse(iso) + n * 86_400_000);

function Trigger({ icon, label, active, open }: { icon: React.ReactNode; label: string; active: boolean; open: boolean }) {
  return (
    <button className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12px] ${active ? 'border-accent/50 bg-accent-soft text-ink' : 'border-line bg-surface text-ink-2 hover:text-ink'} ${open ? 'ring-2 ring-accent/20' : ''}`}>
      {icon}
      <span className="max-w-56 truncate">{label}</span>
      <ChevronDown size={12} className="text-ink-3" />
    </button>
  );
}

function rangeLabel(f: Filters): string {
  if (!f.from && !f.to) return 'All time';
  if (f.from?.endsWith('-01-01') && f.to?.endsWith('-12-31') && f.from.slice(0, 4) === f.to.slice(0, 4)) return f.from.slice(0, 4);
  return `${f.from ?? '…'} → ${f.to ?? '…'}`;
}

function DateRange() {
  const { conv, filters, setFilters } = useConversation();
  const years = useQuery<{ y: number; n: number }>(`SELECT year(ts) AS y, count(*) AS n FROM ctx GROUP BY 1 ORDER BY 1 DESC`).data ?? [];
  const [from, setFrom] = useState(filters.from ?? day(conv.firstTs));
  const [to, setTo] = useState(filters.to ?? day(conv.lastTs));
  const last = day(conv.lastTs);
  const set = (from?: string, to?: string) => setFilters({ ...filters, from, to });
  const presets: [string, string | undefined, string | undefined][] = [
    ['All time', undefined, undefined],
    ['Last 30 days of activity', addDays(last, -29), last],
    ['Last 90 days of activity', addDays(last, -89), last],
    ['Last 12 months of activity', addDays(last, -364), last],
  ];
  const row = (key: string, label: string, f: string | undefined, t: string | undefined, close: () => void, extra?: React.ReactNode) => {
    const selected = filters.from === f && filters.to === t;
    return (
      <button key={key} onClick={() => (set(f, t), close())} className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-2">
        <Check size={14} strokeWidth={3} className={selected ? 'text-accent' : 'invisible'} />
        <span className="flex-1">{label}</span>
        {extra}
      </button>
    );
  };
  return (
    <Popover width={290} trigger={(open) => <Trigger open={open} icon={<Calendar size={13} />} label={rangeLabel(filters)} active={!!(filters.from || filters.to)} />}>
      {(close) => (
        <div className="py-1">
          {presets.map(([label, f, t]) => row(label, label, f, t, close))}
          <div className="mt-1 border-t border-line pt-1">
            <div className="max-h-56 overflow-auto">
              {years.map((y) => row(String(y.y), String(y.y), `${y.y}-01-01`, `${y.y}-12-31`, close, <span className="num text-ink-3">{fmtInt(y.n)}</span>))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 border-t border-line px-3 py-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="num h-7 min-w-0 flex-1 rounded border border-line bg-surface-2 px-1.5 text-[12px]" />
            <span className="text-ink-3">→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="num h-7 min-w-0 flex-1 rounded border border-line bg-surface-2 px-1.5 text-[12px]" />
            <button onClick={() => (set(from, to), close())} className="h-7 rounded bg-accent px-2 text-[12px] font-medium text-white">
              Apply
            </button>
          </div>
        </div>
      )}
    </Popover>
  );
}

function PeopleFilter() {
  const { conv, filters, setFilters } = useConversation();
  const [q, setQ] = useState('');
  const active = conv.people.filter((p) => p.messages > 0);
  const shown = active.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  const sel = new Set(filters.people);
  // An empty selection means everyone, so unticking from there keeps all the others.
  const toggle = (name: string) => {
    const next = new Set(sel.size ? sel : active.map((p) => p.name));
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setFilters({ ...filters, people: next.size === active.length || !next.size ? [] : active.map((p) => p.name).filter((n) => next.has(n)) });
  };
  const label = !sel.size ? 'Everyone' : sel.size === 1 ? filters.people[0] : `${sel.size} people`;
  return (
    <Popover width={300} trigger={(open) => <Trigger open={open} icon={<Users size={13} />} label={label} active={sel.size > 0} />}>
      {() => (
        <div>
          {active.length > 8 && (
            <label className="flex h-9 items-center gap-2 border-b border-line px-3">
              <Search size={13} className="text-ink-3" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter people…" className="w-full bg-transparent outline-none" />
            </label>
          )}
          <div className="max-h-72 overflow-auto py-1">
            {shown.map((p) => (
              <div key={p.name} className="group flex items-center gap-2 px-3 py-1 hover:bg-surface-2">
                <input type="checkbox" checked={!sel.size || sel.has(p.name)} onChange={() => toggle(p.name)} className="accent-[var(--color-accent)]" />
                <Badge name={p.name} />
                <span className="min-w-0 flex-1 truncate">{p.name}{p.isMe && <span className="text-ink-3"> (you)</span>}</span>
                <button onClick={() => setFilters({ ...filters, people: [p.name] })} className="hidden text-[11px] text-accent group-hover:inline">only</button>
                <span className="num text-[11px] text-ink-3 group-hover:hidden">{fmtInt(p.messages)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t border-line px-3 py-1.5 text-[11px]">
            <span className="text-ink-3">{fmtInt(active.length)} people sent messages</span>
            <button className="text-accent" onClick={() => setFilters({ ...filters, people: [] })}>All</button>
          </div>
        </div>
      )}
    </Popover>
  );
}

const KIND_LABELS: Record<KindGroup, string> = { text: 'Text', media: 'Media', link: 'Links', call: 'Calls', other: 'Other' };

function KindsFilter() {
  const { filters, setFilters } = useConversation();
  const sel = new Set(filters.kinds);
  const all = Object.keys(KIND_GROUPS) as KindGroup[];
  const toggle = (k: KindGroup) => {
    const next = sel.size ? new Set(sel) : new Set<KindGroup>();
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setFilters({ ...filters, kinds: next.size === all.length ? [] : all.filter((x) => next.has(x)) });
  };
  return (
    <div className="flex rounded-md border border-line bg-surface p-0.5">
      {all.map((k) => (
        <button
          key={k}
          onClick={() => toggle(k)}
          title={KIND_GROUPS[k].join(', ')}
          className={`h-6 rounded px-2 text-[12px] ${sel.has(k) ? 'bg-accent-soft font-medium text-ink' : 'text-ink-3 hover:text-ink'}`}
        >
          {KIND_LABELS[k]}
        </button>
      ))}
    </div>
  );
}

/** Sections that read the filters differently say so next to them. */
const SCOPE_NOTES: Partial<Record<Section, string>> = {
  people: 'Profiles use dates and types, not the people filter',
  reactions: 'People filter keeps reactions given or received by them',
  wrapped: 'Wrapped ignores these filters',
};

export function FilterBar({ section }: { section: Section }) {
  const { conv, filters, setFilters } = useConversation();
  const count = useQuery<{ n: number }>(`SELECT count(*) AS n FROM sel`).data?.[0]?.n;
  const filtered = !!(filters.from || filters.to || filters.people.length || filters.kinds.length);
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface px-4">
      <DateRange key={`${filters.from}-${filters.to}`} />
      <PeopleFilter />
      <KindsFilter />
      {SCOPE_NOTES[section] && (
        <span className="truncate text-[11px] text-ink-3" title={SCOPE_NOTES[section]}>ⓘ {SCOPE_NOTES[section]}</span>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-3 whitespace-nowrap">
        <span className="num text-ink-3">
          {filtered ? <><b className="font-semibold text-ink">{fmtInt(count)}</b> of {fmtInt(conv.messages)} messages</> : <>{fmtInt(conv.messages)} messages</>}
        </span>
        {filtered && (
          <button onClick={() => setFilters(NO_FILTERS)} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-ink-2 hover:bg-surface-2">
            <X size={13} /> Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
