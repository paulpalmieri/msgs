// Full-screen media viewer: arrows / ← → to browse, esc to close, and a way
// back to the message in the reader.
import { BookOpen, ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { isImageUrl } from '../demo/media';
import { Badge } from '../ui/Badge';
import { useMediaUrl } from './MediaProvider';
import type { MediaType } from './Thumb';

export type MediaItem = {
  uri: string;
  type: MediaType;
  message_id: number;
  ts: number;
  sender: string;
  text?: string | null;
  n_reactions?: number;
};

interface LightboxCtx {
  open: (items: MediaItem[], index: number) => void;
}

const Ctx = createContext<LightboxCtx>({ open: () => undefined });
export const useLightbox = () => useContext(Ctx);

const when = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

function Viewer({ items, index, setIndex, onClose, onContext }: {
  items: MediaItem[]; index: number; setIndex: (i: number) => void; onClose: () => void; onContext: (messageId: number) => void;
}) {
  const item = items[index];
  const url = useMediaUrl(item.uri);
  const step = useCallback((d: number) => setIndex(Math.min(items.length - 1, Math.max(0, index + d))), [index, items.length, setIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (e.stopPropagation(), onClose());
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [step, onClose]);

  // Warm the neighbours so arrowing feels instant.
  useMediaUrl(items[index + 1]?.uri ?? null);
  useMediaUrl(items[index - 1]?.uri ?? null);

  const name = item.uri.split('/').pop() ?? 'file';
  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black/92 text-white" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-12 shrink-0 items-center gap-3 px-4">
        <Badge name={item.sender} size={24} />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium">{item.sender}</div>
          <div className="num text-[11px] text-white/60">{when.format(new Date(item.ts))}{item.n_reactions ? ` · ${item.n_reactions} reactions` : ''}</div>
        </div>
        <span className="num ml-auto text-[12px] text-white/60">{index + 1} / {items.length}</span>
        <button onClick={() => onContext(item.message_id)} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-white/80 hover:bg-white/10 hover:text-white">
          <BookOpen size={14} /> In context
        </button>
        {url && (
          <a href={url} download={name} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-white/80 hover:bg-white/10 hover:text-white">
            <Download size={14} /> Save
          </a>
        )}
        <button onClick={onClose} className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white" title="Close (esc)"><X size={18} /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-16 pb-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        {url === undefined && <div className="text-white/50">Loading…</div>}
        {url === null && <div className="text-white/50">This file isn’t in the export.</div>}
        {url && (item.type === 'video' && !isImageUrl(url) ? (
          <video key={url} src={url} controls autoPlay className="max-h-full max-w-full rounded" />
        ) : item.type === 'audio' ? (
          <audio key={url} src={url} controls autoPlay className="w-[420px]" />
        ) : item.type === 'file' ? (
          <a href={url} target="_blank" rel="noreferrer noopener" className="rounded-md border border-white/20 px-4 py-3 text-white/80 hover:bg-white/10">Open {name}</a>
        ) : (
          <img key={url} src={url} alt="" className="max-h-full max-w-full rounded object-contain" />
        ))}
        {index > 0 && (
          <button onClick={() => step(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 hover:bg-white/20" title="Previous (←)"><ChevronLeft size={22} /></button>
        )}
        {index < items.length - 1 && (
          <button onClick={() => step(1)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 hover:bg-white/20" title="Next (→)"><ChevronRight size={22} /></button>
        )}
      </div>
      {item.text && <div className="mx-auto max-w-3xl shrink-0 px-6 pb-5 text-center text-[14px] text-white/85">{item.text}</div>}
    </div>
  );
}

export function LightboxProvider({ children, onContext }: { children: ReactNode; onContext: (messageId: number) => void }) {
  const [state, setState] = useState<{ items: MediaItem[]; index: number } | null>(null);
  const open = useCallback((items: MediaItem[], index: number) => items.length && setState({ items, index }), []);
  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {state && (
        <Viewer
          items={state.items}
          index={state.index}
          setIndex={(index) => setState((s) => (s ? { ...s, index } : s))}
          onClose={() => setState(null)}
          onContext={(id) => (setState(null), onContext(id))}
        />
      )}
    </Ctx.Provider>
  );
}
