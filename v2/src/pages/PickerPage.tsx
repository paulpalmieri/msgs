// Landing view: choose the conversation to explore.
import { ArrowDown, ArrowUp, Search, Users, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useData } from '../app/DataProvider';
import { DEMO_LABEL } from '../demo/generate';
import { NO_FILTERS, type Route } from '../app/router';
import { useConversations, type ConversationRow } from '../db/useConversations';
import { fmtDate, fmtInt, fmtPct } from '../lib/format';
import { Button } from '../ui/primitives';
import { Sparkline } from '../ui/Sparkline';

const FOLDER_LABELS: Record<string, string> = {
  e2ee_cutover: 'until encryption',
  archived_threads: 'archived',
  filtered_threads: 'filtered',
  message_requests: 'request',
};
const FOLDER_HINTS: Record<string, string> = {
  e2ee_cutover: 'History up to the switch to end-to-end encrypted chats. Later messages are not in Facebook exports.',
};

type SortKey = 'title' | 'messages' | 'participant_count' | 'share' | 'first_ts' | 'last_ts';
type TypeFilter = 'all' | 'direct' | 'group';

export function PickerPage({ navigate }: { navigate: (r: Route) => void }) {
  const { state, reset } = useData();
  const { rows } = useConversations();
  const [q, setQ] = useState('');
  const [type, setType] = useState<TypeFilter>('all');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'messages', desc: true });

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = (rows ?? []).filter(
      (r) => (type === 'all' || (type === 'group') === r.is_group) && (!needle || r.title.toLowerCase().includes(needle)),
    );
    const val = (r: ConversationRow) => (sort.key === 'share' ? r.my_messages / r.messages : r[sort.key]);
    out.sort((a, b) => {
      const va = val(a), vb = val(b);
      const c = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sort.desc ? -c : c;
    });
    return out;
  }, [rows, q, type, sort]);

  const open = (r: ConversationRow) => navigate({ view: 'conversation', threadId: r.thread_id, section: 'overview', filters: NO_FILTERS });
  const info = state.status === 'ready' ? state.info : null;
  const isDemo = info?.source === DEMO_LABEL;

  const th = (key: SortKey, label: string, align: 'left' | 'right' = 'left', width?: string) => (
    <th style={{ width }} className={`border-b border-line px-3 py-2 font-medium text-ink-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        className={`inline-flex items-center gap-1 hover:text-ink ${sort.key === key ? 'text-ink' : ''}`}
        onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== 'title' }))}
      >
        {label}
        {sort.key === key && (sort.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
      </button>
    </th>
  );

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-5">
        <span className="text-[12px] font-semibold tracking-[0.14em]">MSGS</span>
        <span className="text-ink-3">Choose a conversation</span>
        <span className="ml-auto truncate text-ink-3">
          {info?.source} · {fmtInt(rows?.length)} conversations
        </span>
        {isDemo ? (
          <Button variant="primary" onClick={() => reset()}>Import your own export</Button>
        ) : (
          <Button variant="ghost" onClick={() => confirm('Delete the local dataset and import a new export?') && reset()}>
            Import another export
          </Button>
        )}
      </header>

      <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-5 py-2">
        <label className="flex h-8 w-80 items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 focus-within:border-accent">
          <Search size={14} className="text-ink-3" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations…" className="w-full bg-transparent outline-none" />
        </label>
        <div className="flex rounded-md border border-line p-0.5">
          {(['all', 'direct', 'group'] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} className={`h-6 rounded px-2.5 text-[12px] ${type === t ? 'bg-surface-2 font-medium text-ink' : 'text-ink-3 hover:text-ink'}`}>
              {{ all: 'All', direct: 'One-to-one', group: 'Groups' }[t]}
            </button>
          ))}
        </div>
        <span className="num ml-auto text-ink-3">{fmtInt(visible.length)} shown</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-surface">
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr>
              {th('title', 'Conversation')}
              {th('participant_count', 'People', 'right', '6rem')}
              {th('messages', 'Messages', 'right', '7rem')}
              {th('share', 'You', 'right', '5rem')}
              <th className="w-32 border-b border-line px-3 py-2 text-left font-medium text-ink-3">Activity by year</th>
              {th('first_ts', 'First', 'right', '7.5rem')}
              {th('last_ts', 'Last', 'right', '7.5rem')}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.thread_id} onClick={() => open(r)} className="cursor-pointer hover:bg-surface-2">
                <td className="max-w-0 truncate border-b border-line/60 px-3 py-1.5">
                  <span className="inline-flex items-center gap-2">
                    {r.is_group ? <Users size={13} className="text-ink-3" /> : <User size={13} className="text-ink-3" />}
                    <span className="font-medium">{r.title}</span>
                    {r.category !== 'inbox' && (
                      <span title={FOLDER_HINTS[r.category]} className="rounded bg-surface-2 px-1.5 text-[10px] text-ink-3">{FOLDER_LABELS[r.category] ?? r.category.replace('_', ' ')}</span>
                    )}
                  </span>
                </td>
                <td className="num border-b border-line/60 px-3 text-right text-ink-2">{r.participant_count}</td>
                <td className="num border-b border-line/60 px-3 text-right">{fmtInt(r.messages)}</td>
                <td className="num border-b border-line/60 px-3 text-right text-ink-2">{fmtPct(r.my_messages / r.messages, 0)}</td>
                <td className="border-b border-line/60 px-3">
                  <Sparkline values={r.years} />
                </td>
                <td className="num border-b border-line/60 px-3 text-right text-ink-2">{fmtDate(r.first_ts)}</td>
                <td className="num border-b border-line/60 px-3 text-right text-ink-2">{fmtDate(r.last_ts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows && <div className="p-6 text-ink-3">Loading conversations…</div>}
      </div>
    </div>
  );
}
