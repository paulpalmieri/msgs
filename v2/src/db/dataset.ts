// Import pipeline: sources -> parser worker -> Arrow -> DuckDB -> OPFS.
import type { TableName } from '../ingest/arrow';
import { TABLES } from '../ingest/arrow';
import type { ParseSummary, Source, WorkerResponse } from '../ingest/protocol';
import { getEngine, query } from './duckdb';
import { clearSaved, restore, save } from './persist';
import { buildSchemaSQL, PERSISTED_TABLES, SCHEMA_VERSION } from './schema';

export type ImportStage = 'parsing' | 'loading' | 'saving';

export interface ImportProgress {
  stage: ImportStage;
  done?: number;
  total?: number;
  messages?: number;
}

export interface DatasetInfo {
  owner: string | null;
  source: string;
  importedAt: string;
  files: number;
  storedBytes: number | null;
  timings?: { parseMs: number; loadMs: number; saveMs: number };
  restoreMs?: number;
}

function parseInWorker(sources: Source[], onProgress: (p: ImportProgress) => void) {
  return new Promise<{ ipc: Record<TableName, Uint8Array>; summary: ParseSummary }>((resolve, reject) => {
    const worker = new Worker(new URL('../ingest/parser.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === 'progress') onProgress({ stage: 'parsing', ...msg });
      else {
        worker.terminate();
        if (msg.type === 'done') resolve(msg);
        else reject(new Error(msg.message));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message));
    };
    worker.postMessage({ type: 'parse', sources });
  });
}

export async function importSources(
  sources: Source[],
  sourceLabel: string,
  onProgress: (p: ImportProgress) => void,
): Promise<DatasetInfo> {
  if (!sources.length) throw new Error('No message_*.json files found. Pick the folder that contains your export.');
  const { ipc, summary } = await parseInWorker(sources, onProgress);

  onProgress({ stage: 'loading' });
  const t0 = performance.now();
  const { conn } = await getEngine();
  for (const t of TABLES) await conn.insertArrowFromIPCStream(ipc[t], { name: `raw_${t}`, create: true });
  const importedAt = new Date().toISOString();
  const statements = buildSchemaSQL({
    schema_version: SCHEMA_VERSION,
    owner: summary.owner,
    source: sourceLabel,
    imported_at: importedAt,
    files: summary.files,
  });
  for (const sql of statements) await conn.query(sql);
  const loadMs = performance.now() - t0;

  onProgress({ stage: 'saving' });
  const t1 = performance.now();
  const manifest = await save().catch(() => null);
  return {
    owner: summary.owner,
    source: sourceLabel,
    importedAt,
    files: summary.files,
    storedBytes: manifest?.bytes ?? null,
    timings: { parseMs: summary.parseMs, loadMs, saveMs: performance.now() - t1 },
  };
}

async function readInfo(storedBytes: number | null): Promise<DatasetInfo> {
  const rows = await query<{ key: string; value: string | null }>('SELECT key, value FROM meta');
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    owner: m.owner ?? null,
    source: m.source ?? 'unknown',
    importedAt: m.imported_at ?? '',
    files: Number(m.files ?? 0),
    storedBytes,
  };
}

export type BootResult = { status: 'empty' | 'outdated' } | { status: 'ready'; info: DatasetInfo };

let booting: Promise<BootResult> | null = null;

/**
 * Restores the saved dataset once per page load. Shared, because a second
 * concurrent restore (React StrictMode runs effects twice in dev) would
 * register and drop the same Parquet files under the first one.
 */
export function boot(): Promise<BootResult> {
  booting ??= restoreOnce();
  return booting;
}

async function restoreOnce(): Promise<BootResult> {
  const t0 = performance.now();
  const r = await restore();
  if (r.status !== 'restored') return { status: r.status === 'outdated' ? 'outdated' : 'empty' };
  return { status: 'ready', info: { ...(await readInfo(r.manifest.bytes)), restoreMs: performance.now() - t0 } };
}

export async function clearDataset(): Promise<void> {
  await clearSaved();
  const { conn } = await getEngine();
  for (const t of PERSISTED_TABLES) await conn.query(`DROP TABLE IF EXISTS ${t}`);
}
