import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useData, type DataState } from '../app/DataProvider';
import { fromDataTransfer, fromDevExport, fromDirectoryHandle, fromFileList } from '../ingest/sources';
import { fmtInt } from '../lib/format';
import { Button } from '../ui/primitives';

type PickerWindow = Window & { showDirectoryPicker?: (opts?: { mode?: 'read' }) => Promise<FileSystemDirectoryHandle> };

export function ImportPage() {
  const { state, importFrom } = useData();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [devRoot, setDevRoot] = useState<string | null>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    fetch('/__dev_export/manifest')
      .then((r) => (r.ok ? r.json() : null))
      .then((m: { root: string } | null) => setDevRoot(m?.root ?? null))
      .catch(() => undefined);
  }, []);

  const pickFolder = async () => {
    const picker = (window as PickerWindow).showDirectoryPicker;
    if (!picker) return inputRef.current?.click();
    let handle: FileSystemDirectoryHandle;
    try {
      handle = await picker({ mode: 'read' });
    } catch {
      return; // user cancelled
    }
    await importFrom((onFound) => fromDirectoryHandle(handle, onFound), handle.name);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const items = e.dataTransfer.items;
    // fromDataTransfer reads the entries synchronously before its first await.
    const pending = fromDataTransfer(items);
    const label = e.dataTransfer.files[0]?.name ?? 'dropped folder';
    void importFrom(() => pending, label);
  };

  const busy = state.status === 'importing';

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-xl">
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">MSGS · v2</div>
          <h1 className="mt-1 text-[22px] font-semibold">Import a Messenger export</h1>
          <p className="mt-1 text-ink-2">
            Everything is parsed and queried locally in this browser. Only the <code className="font-mono text-[12px]">message_*.json</code> files are read; photos and videos are skipped.
          </p>
        </div>

        {busy ? (
          <Progress state={state} />
        ) : (
          <>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center ${dragging ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
            >
              <div className="text-ink-2">Drop the export folder here (or all its <code className="font-mono text-[12px]">facebook-*</code> folders at once)</div>
              <div className="flex gap-2">
                <Button variant="primary" onClick={pickFolder}>
                  Choose export folder…
                </Button>
                {devRoot && (
                  <Button onClick={() => importFrom(async () => (await fromDevExport())?.sources ?? [], devRoot)}>
                    Load dev export ({devRoot})
                  </Button>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                {...{ webkitdirectory: '' }}
                onChange={(e) => {
                  const files = e.target.files;
                  if (files?.length) void importFrom(async () => fromFileList(files), files[0].webkitRelativePath.split('/')[0]);
                }}
              />
            </div>
            {state.status === 'empty' && state.error && <p className="mt-3 rounded-md border border-danger/40 px-3 py-2 text-danger">{state.error}</p>}
            {state.status === 'empty' && state.outdated && (
              <p className="mt-3 text-ink-2">Your saved dataset was made by an older version of the app. Import the export again to rebuild it.</p>
            )}
            <details className="mt-5 text-ink-2">
              <summary className="cursor-pointer select-none text-ink">How to get your export</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Facebook → Settings → Your information → Download your information.</li>
                <li>Choose <b>Messages</b>, format <b>JSON</b>, date range <b>All time</b>. Media quality doesn't matter.</li>
                <li>Unzip every part into one folder, then choose or drop that folder here.</li>
              </ol>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

const STAGES = [
  ['scanning', 'Finding message files'],
  ['parsing', 'Parsing and repairing text'],
  ['loading', 'Building tables in DuckDB'],
  ['saving', 'Saving to browser storage'],
] as const;

function Progress({ state }: { state: Extract<DataState, { status: 'importing' }> }) {
  const p = state.progress;
  const current = STAGES.findIndex(([s]) => s === p.stage);
  const detail = (stage: string) => {
    if (stage !== p.stage) return null;
    if ('found' in p) return `${fmtInt(p.found)} files`;
    if (p.stage === 'parsing' && p.total) return `${fmtInt(p.done)} / ${fmtInt(p.total)} files · ${fmtInt(p.messages)} messages`;
    return null;
  };
  const pct = p.stage === 'parsing' && p.total ? (p.done ?? 0) / p.total : null;

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <ul className="space-y-2">
        {STAGES.map(([stage, label], i) => (
          <li key={stage} className={`flex items-center gap-2 ${i > current ? 'text-ink-3' : ''}`}>
            <span className={`size-2 rounded-full ${i < current ? 'bg-accent' : i === current ? 'animate-pulse bg-accent' : 'bg-line'}`} />
            <span className="flex-1">{label}</span>
            <span className="num text-ink-3">{detail(stage)}</span>
          </li>
        ))}
      </ul>
      {pct !== null && (
        <div className="mt-3 h-1 rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct * 100}%` }} />
        </div>
      )}
    </div>
  );
}
