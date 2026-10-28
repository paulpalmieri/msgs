// Path rules shared by the browser folder walkers and the dev server plugin.
// An export is ~99% media by size, so walkers prune aggressively and only
// collect messages/<category>/<thread>/message_N.json files.

const MEDIA_DIRS = new Set(['photos', 'videos', 'gifs', 'audio', 'files', 'stickers_used']);
const ACTIVITY_DIR = /^your_(facebook|instagram)_activity$/;
const MESSAGE_FILE = /^message_\d+\.json$/;

/** Whether a walker should descend into `name`, given its parent directory name. */
export function shouldDescend(name: string, parent: string | undefined): boolean {
  if (MEDIA_DIRS.has(name)) return false;
  if (parent && ACTIVITY_DIR.test(parent)) return name === 'messages';
  return true;
}

/** Whether a relative path (any separator) points at a thread's message JSON. */
export function isMessageFile(path: string): boolean {
  const parts = path.split(/[\\/]/);
  const file = parts[parts.length - 1];
  return MESSAGE_FILE.test(file) && parts.includes('messages');
}

/** Whether a path inside a full (unpruned) listing could matter at all. */
export function isRelevantPath(path: string): boolean {
  const parts = path.split(/[\\/]/);
  for (let i = 0; i < parts.length - 1; i++) {
    if (!shouldDescend(parts[i], parts[i - 1])) return false;
  }
  return isMessageFile(path);
}
