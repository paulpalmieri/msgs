// Where media files come from. Message JSON stores each attachment as a path
// relative to an export *part* (your_facebook_activity/messages/...), and a
// conversation's files are spread across parts, so a resolver checks every
// part and remembers which folder listing holds which file.

export interface MediaSource {
  kind: 'folders' | 'files' | 'dev';
  /** A URL an <img>/<video> can load, or null when the file isn't in the export. */
  url(uri: string): Promise<string | null>;
}

type Dir = FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemHandle> };

const ACTIVITY = /^your_(facebook|instagram)_activity$/;

/** Export parts under the picked folders: each picked folder, or its children, that hold your_*_activity. */
export async function findParts(roots: FileSystemDirectoryHandle[]): Promise<FileSystemDirectoryHandle[]> {
  const parts: FileSystemDirectoryHandle[] = [];
  const isPart = async (d: Dir) => {
    for await (const h of d.values()) if (h.kind === 'directory' && ACTIVITY.test(h.name)) return true;
    return false;
  };
  for (const r of roots as Dir[]) {
    if (await isPart(r)) {
      parts.push(r);
      continue;
    }
    for await (const h of r.values()) if (h.kind === 'directory' && (await isPart(h as Dir))) parts.push(h as FileSystemDirectoryHandle);
  }
  return parts;
}

/** Object URLs for Files, revoking the least recently used past a cap. */
class UrlCache {
  private map = new Map<string, string>();
  constructor(private cap = 600) {}
  get(key: string, make: () => string): string {
    const hit = this.map.get(key);
    if (hit) {
      this.map.delete(key);
      this.map.set(key, hit);
      return hit;
    }
    const url = make();
    this.map.set(key, url);
    if (this.map.size > this.cap) {
      const [oldKey, oldUrl] = this.map.entries().next().value!;
      this.map.delete(oldKey);
      URL.revokeObjectURL(oldUrl);
    }
    return url;
  }
}

export function folderSource(parts: FileSystemDirectoryHandle[]): MediaSource {
  const listings = new Map<string, Promise<Map<string, FileSystemFileHandle>>>();
  const cache = new UrlCache();
  const list = (dir: string) => {
    let p = listings.get(dir);
    if (!p) {
      p = (async () => {
        const out = new Map<string, FileSystemFileHandle>();
        for (const part of parts) {
          let d: FileSystemDirectoryHandle | null = part;
          for (const seg of dir.split('/')) {
            try {
              d = await d.getDirectoryHandle(seg);
            } catch {
              d = null;
              break;
            }
          }
          if (!d) continue;
          for await (const h of (d as Dir).values()) if (h.kind === 'file' && !out.has(h.name)) out.set(h.name, h as FileSystemFileHandle);
        }
        return out;
      })();
      listings.set(dir, p);
    }
    return p;
  };
  return {
    kind: 'folders',
    async url(uri) {
      const i = uri.lastIndexOf('/');
      const handle = (await list(uri.slice(0, i))).get(uri.slice(i + 1));
      if (!handle) return null;
      // A File from a handle reads lazily from disk, so even large videos are cheap to point at.
      const file = await handle.getFile();
      return cache.get(uri, () => URL.createObjectURL(file));
    },
  };
}

/** From an <input webkitdirectory> pick: works until the page reloads. */
export function filesSource(files: File[]): MediaSource {
  const byPath = new Map<string, File>();
  for (const f of files) {
    const m = /(your_(?:facebook|instagram)_activity\/.*)$/.exec(f.webkitRelativePath);
    if (m && !f.name.endsWith('.json')) byPath.set(m[1], f);
  }
  const cache = new UrlCache();
  return {
    kind: 'files',
    async url(uri) {
      const f = byPath.get(uri);
      return f ? cache.get(uri, () => URL.createObjectURL(f)) : null;
    },
  };
}

/** Dev only: files served by dev/devExportPlugin.ts. */
export function devSource(): MediaSource {
  return { kind: 'dev', url: async (uri) => `/__dev_export/media?u=${encodeURIComponent(uri)}` };
}
