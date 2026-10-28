import { useEffect, useState } from 'react';
import { ConversationProvider, useConversation } from '../app/ConversationProvider';
import { NO_FILTERS, type Filters, type Route, type Section } from '../app/router';
import { Activity } from '../sections/Activity';
import { Content } from '../sections/Content';
import { Messages } from '../sections/Messages';
import { Overview } from '../sections/Overview';
import { People } from '../sections/People';
import { Reactions } from '../sections/Reactions';
import { Relations } from '../sections/Relations';
import { Soon } from '../sections/Soon';
import { SqlSection } from '../sections/SqlSection';
import { Wrapped } from '../sections/Wrapped';
import { ConversationSwitcher } from '../shell/ConversationSwitcher';
import { FilterBar } from '../shell/FilterBar';
import { Inspector } from '../shell/Inspector';
import { NAV, Sidebar } from '../shell/Sidebar';

const isTyping = (e: KeyboardEvent) => e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]');

function SectionView({ section, label, who, at, openPerson }: { section: Section; label: string; who?: string; at?: number; openPerson: (name: string) => void }) {
  switch (section) {
    case 'overview': return <Overview openPerson={openPerson} />;
    case 'activity': return <Activity />;
    case 'people': return <People who={who} setWho={openPerson} />;
    case 'relations': return <Relations openPerson={openPerson} />;
    case 'reactions': return <Reactions openPerson={openPerson} />;
    case 'content': return <Content />;
    case 'messages': return <Messages at={at} />;
    case 'wrapped': return <Wrapped />;
    case 'sql': return <SqlSection />;
    default: return <Soon label={label} />;
  }
}

function Layout({ section, who, at, navigate }: { section: Section; who?: string; at?: number; navigate: (r: Route) => void }) {
  const { conv, filters, epoch } = useConversation();
  const [switching, setSwitching] = useState(false);
  const go = (s: Section) => navigate({ view: 'conversation', threadId: conv.threadId, section: s, filters, who });
  const openPerson = (name: string) => navigate({ view: 'conversation', threadId: conv.threadId, section: 'people', filters, who: name });
  const openInReader = (messageId: number) => navigate({ view: 'conversation', threadId: conv.threadId, section: 'messages', filters, who, at: messageId });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSwitching((s) => !s);
      } else if (!isTyping(e) && !e.metaKey && !e.ctrlKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        const n = NAV[Number(e.key) - 1];
        if (n) go(n.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const nav = NAV.find((n) => n.id === section)!;
  return (
    <div className="flex h-full">
      <Sidebar section={section} onSection={go} onSwitch={() => setSwitching(true)} onHome={() => navigate({ view: 'picker' })} />
      <div className="flex min-w-0 flex-1 flex-col">
        <FilterBar />
        <main className="@container min-h-0 flex-1 overflow-auto">
          {epoch === 0 ? null : <SectionView section={section} label={nav.label} who={who} at={at} openPerson={openPerson} />}
        </main>
      </div>
      <Inspector onOpen={openInReader} />
      {switching && (
        <ConversationSwitcher
          onClose={() => setSwitching(false)}
          onPick={(r) => {
            setSwitching(false);
            navigate({ view: 'conversation', threadId: r.thread_id, section, filters: NO_FILTERS });
          }}
        />
      )}
    </div>
  );
}

export function ConversationPage({ route, navigate }: { route: Extract<Route, { view: 'conversation' }>; navigate: (r: Route) => void }) {
  const setFilters = (filters: Filters) => navigate({ ...route, filters });
  return (
    <ConversationProvider
      threadId={route.threadId}
      filters={route.filters}
      setFilters={setFilters}
      fallback={(s) => (
        <div className="flex h-full items-center justify-center text-ink-3">
          {s === 'loading' ? 'Loading conversation…' : <button onClick={() => navigate({ view: 'picker' })}>Conversation not found. Back to the list</button>}
        </div>
      )}
    >
      <Layout section={route.section} who={route.who} at={route.at} navigate={navigate} />
    </ConversationProvider>
  );
}
