// One attachment as a tile. Resolves its file only once it scrolls into view,
// so a gallery of thousands only touches what's on screen.
import { File as FileIcon, ImageOff, Mic, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useMedia, useMediaUrl } from './MediaProvider';

export type MediaType = 'photo' | 'video' | 'gif' | 'sticker' | 'audio' | 'file';

function useVisible<T extends Element>(margin = '300px') {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [visible, margin]);
  return [ref, visible] as const;
}

export function Thumb({ uri, type, onClick, className = '', fit = 'cover' }: {
  uri: string; type: MediaType; onClick?: () => void; className?: string; fit?: 'cover' | 'contain';
}) {
  const { status } = useMedia();
  const [ref, visible] = useVisible<HTMLElement>();
  const url = useMediaUrl(visible && status === 'ready' && type !== 'audio' && type !== 'file' ? uri : null);
  const fitClass = fit === 'cover' ? 'object-cover' : 'object-contain';
  const base = `group relative block overflow-hidden rounded-md bg-surface-2 ${onClick ? 'cursor-zoom-in' : ''} ${className}`;
  const icon = (node: React.ReactNode, label?: string) => (
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-ink-3">
      {node}
      {label && <span className="max-w-full truncate px-1 text-[10px]">{label}</span>}
    </span>
  );
  let body: React.ReactNode;
  if (type === 'audio') body = icon(<Mic size={18} />, 'voice note');
  else if (type === 'file') body = icon(<FileIcon size={18} />, uri.split('.').pop()?.toUpperCase());
  else if (status !== 'ready') body = icon(<ImageOff size={16} />);
  // Not scrolled into view yet, or still resolving: a placeholder, not "missing".
  else if (!visible || url === undefined) body = <span className="absolute inset-0 animate-pulse bg-surface-2" />;
  else if (url === null) body = icon(<ImageOff size={16} />, 'not in export');
  else if (type === 'video') {
    body = (
      <>
        <video src={`${url}#t=0.1`} preload="metadata" muted playsInline className={`h-full w-full ${fitClass}`} />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/55 p-2 text-white"><Play size={14} fill="currentColor" /></span>
        </span>
      </>
    );
  } else {
    body = <img src={url} alt="" loading="lazy" decoding="async" className={`h-full w-full ${type === 'sticker' ? 'object-contain p-1' : fitClass}`} />;
  }
  const content = (
    <>
      {body}
      {type === 'gif' && url && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] font-semibold text-white">GIF</span>}
    </>
  );
  // A span when not clickable, so a thumbnail can sit inside another button.
  return onClick ? (
    <button ref={ref as React.RefObject<HTMLButtonElement>} type="button" onClick={onClick} className={base} title={type}>{content}</button>
  ) : (
    <span ref={ref as React.RefObject<HTMLSpanElement>} className={base}>{content}</span>
  );
}
