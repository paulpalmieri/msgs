// Collects message JSON files from whatever the user hands us: a directory
// picker handle, a drag-and-drop, an <input webkitdirectory>, or the dev plugin.
import { isRelevantPath, isMessageFile, shouldDescend } from './paths';
import type { Source } from './protocol';

type DirHandle = FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemHandle> };

export async function fromDirectoryHandle(root: FileSystemDirectoryHandle, onFound?: (n: number) => void): Promise<Source[]> {
  const out: Source[] = [];
  const walk = async (dir: DirHandle, path: string, parent: string | undefined) => {
    for await (const h of dir.values()) {
      const p = `${path}/${h.name}`;
      if (h.kind === 'directory') {
        if (shouldDescend(h.name, parent)) await walk(h as DirHandle, p, h.name);
      } else if (isMessageFile(p)) {
        out.push({ path: p, file: await (h as FileSystemFileHandle).getFile() });
        onFound?.(out.length);
      }
    }
  };
  await walk(root as DirHandle, root.name, undefined);
  return out;
}

export async function fromDataTransfer(items: DataTransferItemList, onFound?: (n: number) => void): Promise<Source[]> {
  // Entries must be taken synchronously, before the first await.
  const entries = [...items].map((i) => i.webkitGetAsEntry()).filter((e): e is FileSystemEntry => e !== null);
  const out: Source[] = [];
  const readAll = (dir: FileSystemDirectoryEntry) =>
    new Promise<FileSystemEntry[]>((resolve, reject) => {
      const reader = dir.createReader();
      const acc: FileSystemEntry[] = [];
      const batch = () => reader.readEntries((es) => (es.length ? (acc.push(...es), batch()) : resolve(acc)), reject);
      batch();
    });
  const walk = async (entry: FileSystemEntry, parent: string | undefined): Promise<void> => {
    if (entry.isDirectory) {
      if (!shouldDescend(entry.name, parent)) return;
      for (const child of await readAll(entry as FileSystemDirectoryEntry)) await walk(child, entry.name);
    } else if (isMessageFile(entry.fullPath)) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      out.push({ path: entry.fullPath.replace(/^\//, ''), file });
      onFound?.(out.length);
    }
  };
  for (const e of entries) await walk(e, undefined);
  return out;
}

export function fromFileList(files: FileList): Source[] {
  return [...files].filter((f) => isRelevantPath(f.webkitRelativePath)).map((f) => ({ path: f.webkitRelativePath, file: f }));
}

/** Dev only: files served by dev/devExportPlugin.ts from MSGS_EXPORT_DIR. */
export async function fromDevExport(): Promise<{ root: string; sources: Source[] } | null> {
  const res = await fetch('/__dev_export/manifest').catch(() => null);
  if (!res?.ok) return null;
  const { root, files } = (await res.json()) as { root: string; files: string[] };
  const base = new URL('/__dev_export/file', location.href);
  return {
    root,
    sources: files.map((p) => {
      base.searchParams.set('p', p);
      return { path: `${root}/${p}`, url: base.toString() };
    }),
  };
}
