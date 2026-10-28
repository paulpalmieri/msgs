import { FolderOpen } from 'lucide-react';
import { useMedia } from './MediaProvider';

/** Shown where media would appear but the export folder isn't readable. */
export function MediaBanner({ compact = false }: { compact?: boolean }) {
  const { status, connect, reconnect } = useMedia();
  if (status === 'ready' || status === 'checking') return null;
  const needs = status === 'needs-permission';
  return (
    <div className={`flex items-center gap-3 rounded-lg border border-line bg-surface ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
      <FolderOpen size={16} className="shrink-0 text-ink-3" />
      <span className="min-w-0 flex-1 text-ink-2">
        {needs
          ? 'To show photos and videos, the browser needs permission to read your export folder again.'
          : 'Photos and videos are read straight from your export folder, nothing is copied. Choose the folder to show them.'}
      </span>
      <button onClick={() => void (needs ? reconnect() : connect())} className="h-7 shrink-0 rounded-md bg-accent px-3 text-[12px] font-medium text-white">
        {needs ? 'Allow access' : 'Choose export folder'}
      </button>
    </div>
  );
}
