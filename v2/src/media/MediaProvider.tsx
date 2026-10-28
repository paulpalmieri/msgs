// Media access for the whole app: which source is active, and whether the
// browser still lets us read the export folder.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useData } from '../app/DataProvider';
import { DEMO_LABEL } from '../demo/generate';
import { demoSource } from '../demo/media';
import { devSource, filesSource, findParts, folderSource, type MediaSource } from './sources';
import { loadRoots, permission, saveRoots } from './store';

export type MediaStatus = 'checking' | 'none' | 'needs-permission' | 'ready';

interface MediaCtx {
  status: MediaStatus;
  source: MediaSource | null;
  /** Bumps when the source changes, so components re-resolve their URLs. */
  version: number;
  /** Ask for the export folder (needs a click). */
  connect: () => Promise<void>;
  /** Re-grant access to the remembered folder (needs a click). */
  reconnect: () => Promise<void>;
  setFolders: (roots: FileSystemDirectoryHandle[]) => Promise<void>;
  setFiles: (files: File[]) => void;
  setDev: () => void;
  setDemo: () => void;
}

const Ctx = createContext<MediaCtx | null>(null);

type PickerWindow = Window & { showDirectoryPicker?: (o?: { mode?: 'read' }) => Promise<FileSystemDirectoryHandle> };

async function devAvailable(): Promise<boolean> {
  if (!import.meta.env.DEV) return false;
  const r = await fetch('/__dev_export/manifest').catch(() => null);
  return !!r?.ok;
}

export function MediaProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<MediaStatus>('checking');
  const [source, setSource] = useState<MediaSource | null>(null);
  const [version, setVersion] = useState(0);
  const [roots, setRoots] = useState<FileSystemDirectoryHandle[]>([]);

  const activate = useCallback((s: MediaSource) => {
    setSource(s);
    setStatus('ready');
    setVersion((v) => v + 1);
  }, []);

  const setFolders = useCallback(async (picked: FileSystemDirectoryHandle[]) => {
    const parts = await findParts(picked);
    if (!parts.length) return;
    setRoots(picked);
    await saveRoots(picked);
    activate(folderSource(parts));
  }, [activate]);

  // The demo's media is generated, whatever folder access was saved before.
  const { state } = useData();
  const isDemo = state.status === 'ready' && state.info.source === DEMO_LABEL;
  useEffect(() => {
    if (isDemo && source?.kind !== 'demo') activate(demoSource());
  }, [isDemo, source, activate]);

  useEffect(() => {
    (async () => {
      const saved = await loadRoots();
      if (saved.length) {
        setRoots(saved);
        if (await permission(saved, false)) return activate(folderSource(await findParts(saved)));
        return setStatus('needs-permission');
      }
      if (await devAvailable()) return activate(devSource());
      setStatus('none');
    })().catch(() => setStatus('none'));
  }, [activate]);

  const value = useMemo<MediaCtx>(() => ({
    status,
    source,
    version,
    setFolders,
    setFiles: (files) => activate(filesSource(files)),
    setDev: () => activate(devSource()),
    setDemo: () => activate(demoSource()),
    reconnect: async () => {
      if (await permission(roots, true)) activate(folderSource(await findParts(roots)));
    },
    connect: async () => {
      const picker = (window as PickerWindow).showDirectoryPicker;
      if (!picker) return;
      try {
        await setFolders([await picker({ mode: 'read' })]);
      } catch {
        // cancelled
      }
    },
  }), [status, source, version, roots, setFolders, activate]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMedia(): MediaCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useMedia outside MediaProvider');
  return c;
}

/** URL for one attachment: undefined while resolving, null when unavailable. */
export function useMediaUrl(uri: string | null): string | null | undefined {
  const { source, version } = useMedia();
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!uri || !source) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    setUrl(undefined);
    source.url(uri).then((u) => !cancelled && setUrl(u), () => !cancelled && setUrl(null));
    return () => {
      cancelled = true;
    };
  }, [uri, source, version]);
  return url;
}
