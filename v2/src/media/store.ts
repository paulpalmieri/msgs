// Remembers the picked export folders between visits. Directory handles can
// only be kept in IndexedDB; reading them again needs the user's permission,
// which the browser asks for on a click.

const DB = 'msgs-v2-media';
const STORE = 'handles';
const KEY = 'export-roots';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveRoots(roots: FileSystemDirectoryHandle[]): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(roots, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Storage unavailable: media still works for this visit.
  }
}

export async function loadRoots(): Promise<FileSystemDirectoryHandle[]> {
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle[] | undefined) ?? []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

type PermissionHandle = FileSystemDirectoryHandle & {
  queryPermission?(o: { mode: 'read' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'read' }): Promise<PermissionState>;
};

export async function permission(roots: FileSystemDirectoryHandle[], ask: boolean): Promise<boolean> {
  for (const r of roots as PermissionHandle[]) {
    const state = ask ? await r.requestPermission?.({ mode: 'read' }) : await r.queryPermission?.({ mode: 'read' });
    if (state !== 'granted') return false;
  }
  return roots.length > 0;
}
