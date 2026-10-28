// Keeps the imported dataset in the Origin Private File System as Parquet,
// so reloads skip the JSON parse entirely.
import { getEngine } from './duckdb';
import { PERSISTED_TABLES, SCHEMA_VERSION } from './schema';

const DIR = 'msgs-v2';
const MANIFEST = 'manifest.json';

export interface Manifest {
  schemaVersion: number;
  savedAt: string;
  bytes: number;
}

async function dir(create: boolean): Promise<FileSystemDirectoryHandle | null> {
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(DIR, { create });
  } catch {
    return null;
  }
}

async function writeFile(d: FileSystemDirectoryHandle, name: string, data: Uint8Array | string) {
  const w = await (await d.getFileHandle(name, { create: true })).createWritable();
  await w.write(data as FileSystemWriteChunkType);
  await w.close();
}

export async function save(): Promise<Manifest | null> {
  const d = await dir(true);
  if (!d) return null;
  await navigator.storage.persist?.().catch(() => false);
  const { db, conn } = await getEngine();
  let bytes = 0;
  for (const t of PERSISTED_TABLES) {
    const file = `${t}.parquet`;
    await conn.query(`COPY ${t} TO '${file}' (FORMAT PARQUET, COMPRESSION ZSTD)`);
    const buf = await db.copyFileToBuffer(file);
    await db.dropFile(file);
    await writeFile(d, file, buf);
    bytes += buf.byteLength;
  }
  const manifest: Manifest = { schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString(), bytes };
  await writeFile(d, MANIFEST, JSON.stringify(manifest));
  return manifest;
}

export type RestoreResult = { status: 'none' } | { status: 'outdated' } | { status: 'restored'; manifest: Manifest };

export async function restore(): Promise<RestoreResult> {
  const d = await dir(false);
  if (!d) return { status: 'none' };
  let manifest: Manifest;
  try {
    manifest = JSON.parse(await (await (await d.getFileHandle(MANIFEST)).getFile()).text());
  } catch {
    return { status: 'none' };
  }
  if (manifest.schemaVersion !== SCHEMA_VERSION) return { status: 'outdated' };
  const { db, conn } = await getEngine();
  for (const t of PERSISTED_TABLES) {
    const file = `${t}.parquet`;
    const data = await (await d.getFileHandle(file)).getFile();
    await db.registerFileBuffer(file, new Uint8Array(await data.arrayBuffer()));
    await conn.query(`CREATE OR REPLACE TABLE ${t} AS SELECT * FROM '${file}'`);
    await db.dropFile(file);
  }
  return { status: 'restored', manifest };
}

export async function clearSaved(): Promise<void> {
  const root = await navigator.storage.getDirectory().catch(() => null);
  await root?.removeEntry(DIR, { recursive: true }).catch(() => undefined);
}
