import {
  ArrowLeftRight, CalendarDays, ChevronLeft, Image, LayoutDashboard, MessagesSquare, Network, Smile, Sparkles, Terminal, Type, Users,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useConversation } from '../app/ConversationProvider';
import type { Section } from '../app/router';
import { fmtInt } from '../lib/format';
import { useMedia } from '../media/MediaProvider';
import { Badge } from '../ui/Badge';

export const NAV: { id: Section; label: string; icon: LucideIcon; ready?: boolean }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, ready: true },
  { id: 'activity', label: 'Activity', icon: CalendarDays, ready: true },
  { id: 'people', label: 'People', icon: Users, ready: true },
  { id: 'relations', label: 'Relations', icon: Network, ready: true },
  { id: 'reactions', label: 'Reactions', icon: Smile, ready: true },
  { id: 'content', label: 'Content', icon: Type, ready: true },
  { id: 'media', label: 'Media', icon: Image, ready: true },
  { id: 'messages', label: 'Messages', icon: MessagesSquare, ready: true },
  { id: 'sql', label: 'SQL', icon: Terminal, ready: true },
  { id: 'wrapped', label: 'Wrapped', icon: Sparkles, ready: true },
];

const PEOPLE_SHOWN = 12;

/** Keys 1–9 then 0 select sections. */
export const navKey = (i: number) => (i < 9 ? String(i + 1) : i === 9 ? '0' : '');

export function Sidebar({ section, onSection, onSwitch, onHome }: {
  section: Section;
  onSection: (s: Section) => void;
  onSwitch: () => void;
  onHome: () => void;
}) {
  const { conv, filters, setFilters } = useConversation();
  const [allPeople, setAllPeople] = useState(false);
  const active = conv.people.filter((p) => p.messages > 0);
  const people = allPeople ? active : active.slice(0, PEOPLE_SHOWN);
  const max = active[0]?.messages ?? 1;
  const selected = new Set(filters.people);
  const year = (ms: number) => new Date(ms).getFullYear();

  return (
    <nav className="flex w-[232px] shrink-0 flex-col border-r border-line bg-surface">
      <button onClick={onHome} className="flex h-11 shrink-0 items-center gap-1.5 border-b border-line px-3 text-left text-ink-3 hover:text-ink">
        <ChevronLeft size={14} />
        <span className="text-[12px] font-semibold tracking-[0.14em] text-ink">MSGS</span>
        <span className="text-[12px]">· all conversations</span>
      </button>

      <div className="border-b border-line p-3">
        <div className="line-clamp-2 text-[14px] font-semibold leading-snug">{conv.title}</div>
        <div className="num mt-1 text-[11px] text-ink-3">
          {conv.isGroup ? `Group · ${conv.participantCount} members` : 'One-to-one'} · {fmtInt(conv.messages)} msgs · {year(conv.firstTs)}–{year(conv.lastTs)}
        </div>
        <button onClick={onSwitch} className="mt-2 flex h-7 w-full items-center gap-1.5 rounded-md border border-line px-2 text-[12px] text-ink-2 hover:bg-surface-2">
          <ArrowLeftRight size={13} /> Switch conversation
          <kbd className="ml-auto text-[10px] text-ink-3">⌘K</kbd>
        </button>
      </div>

      <div className="border-b border-line py-2">
        {NAV.map((n, i) => (
          <button
            key={n.id}
            onClick={() => onSection(n.id)}
            className={`flex h-8 w-full items-center gap-2.5 px-3 text-left ${section === n.id ? 'bg-accent-soft font-medium text-ink' : 'text-ink-2 hover:bg-surface-2'}`}
          >
            <n.icon size={15} className={section === n.id ? 'text-accent' : 'text-ink-3'} />
            <span className="flex-1">{n.label}</span>
            {!n.ready && <span className="text-[10px] text-ink-3">soon</span>}
            <kbd className="text-[10px] text-ink-3">{navKey(i)}</kbd>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-2">
        <div className="flex items-center px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-ink-3">
          People
          {selected.size > 0 && <button className="ml-auto normal-case tracking-normal text-accent" onClick={() => setFilters({ ...filters, people: [] })}>show all</button>}
        </div>
        {people.map((p) => {
          const dim = selected.size > 0 && !selected.has(p.name);
          return (
            <button
              key={p.name}
              title="Click to focus on this person, ⇧-click to add to the selection"
              onClick={(e) => {
                const next = e.shiftKey ? (selected.has(p.name) ? [...selected].filter((n) => n !== p.name) : [...selected, p.name]) : selected.size === 1 && selected.has(p.name) ? [] : [p.name];
                setFilters({ ...filters, people: next });
              }}
              className={`relative flex h-7 w-full items-center gap-2 px-3 text-left hover:bg-surface-2 ${dim ? 'opacity-40' : ''}`}
            >
              <span className="absolute inset-y-1 left-0 rounded-r bg-surface-2" style={{ width: `${(p.messages / max) * 100}%` }} />
              <Badge name={p.name} className="relative" />
              <span className="relative min-w-0 flex-1 truncate">{p.name}{p.isMe && <span className="text-ink-3"> (you)</span>}</span>
              <span className="num relative text-[11px] text-ink-3">{fmtInt(p.messages)}</span>
            </button>
          );
        })}
        {active.length > PEOPLE_SHOWN && (
          <button onClick={() => setAllPeople((a) => !a)} className="px-3 py-1 text-[11px] text-accent">
            {allPeople ? 'Show fewer' : `Show all ${active.length}`}
          </button>
        )}
      </div>
      <MediaStatusLine />
    </nav>
  );
}

/** Whether photos can be shown, with the one click that fixes it when not. */
function MediaStatusLine() {
  const { status, connect, reconnect } = useMedia();
  if (status === 'checking') return null;
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-t border-line px-3 text-[11px]">
      <Image size={13} className="text-ink-3" />
      {status === 'ready' ? (
        <span className="text-ink-3">Photos &amp; videos available</span>
      ) : (
        <button onClick={() => void (status === 'needs-permission' ? reconnect() : connect())} className="text-accent hover:underline">
          {status === 'needs-permission' ? 'Allow access to show photos' : 'Choose export folder to show photos'}
        </button>
      )}
    </div>
  );
}
