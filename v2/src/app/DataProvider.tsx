import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { boot, clearDataset, importSources, type DatasetInfo, type ImportProgress } from '../db/dataset';
import type { Source } from '../ingest/protocol';

export type DataState =
  | { status: 'booting' }
  | { status: 'empty'; outdated?: boolean; error?: string }
  | { status: 'importing'; progress: ImportProgress | { stage: 'scanning'; found: number } }
  | { status: 'ready'; info: DatasetInfo; version: number };

type Collect = (onFound: (n: number) => void) => Promise<Source[]>;

interface DataContextValue {
  state: DataState;
  importFrom: (collect: Collect, label: string) => Promise<void>;
  reset: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>({ status: 'booting' });

  useEffect(() => {
    boot()
      .then((r) => setState(r.status === 'ready' ? { status: 'ready', info: r.info, version: 1 } : { status: 'empty', outdated: r.status === 'outdated' }))
      .catch((e: unknown) => setState({ status: 'empty', error: `Could not start the database: ${String(e)}` }));
  }, []);

  const importFrom = useCallback(async (collect: Collect, label: string) => {
    setState({ status: 'importing', progress: { stage: 'scanning', found: 0 } });
    try {
      const sources = await collect((found) => setState({ status: 'importing', progress: { stage: 'scanning', found } }));
      const info = await importSources(sources, label, (progress) => setState({ status: 'importing', progress }));
      setState((s) => ({ status: 'ready', info, version: (s.status === 'ready' ? s.version : 0) + 1 }));
    } catch (e: unknown) {
      setState({ status: 'empty', error: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  const reset = useCallback(async () => {
    await clearDataset();
    setState({ status: 'empty' });
  }, []);

  return <DataContext.Provider value={{ state, importFrom, reset }}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData outside DataProvider');
  return ctx;
}

/** Changes whenever a new dataset is loaded; use as a cache key. */
export function useDatasetVersion(): number {
  const { state } = useData();
  return state.status === 'ready' ? state.version : 0;
}
