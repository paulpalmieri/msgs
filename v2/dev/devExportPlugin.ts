// Dev-only: serves the message JSON (and media) of a local export so the app
// can load it without picking a 29 GB folder each time. Never active in
// production builds.
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { isMessageFile, shouldDescend } from '../src/ingest/paths.ts';

function listMessageFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, parent: string | undefined) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (shouldDescend(entry.name, parent)) walk(full, entry.name);
      } else if (isMessageFile(full)) {
        out.push(path.relative(root, full));
      }
    }
  };
  walk(root, undefined);
  return out.sort();
}

const MEDIA_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  aac: 'audio/aac', m4a: 'audio/mp4', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav',
  pdf: 'application/pdf',
};

/** Export parts: the folders holding your_*_activity (or the export itself if it is one). */
function partRoots(root: string): string[] {
  const has = (d: string) => fs.readdirSync(d).some((n) => /^your_(facebook|instagram)_activity$/.test(n));
  if (has(root)) return [root];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && has(path.join(root, e.name)))
    .map((e) => path.join(root, e.name));
}

export function devExportPlugin(exportDir: string | undefined): Plugin {
  return {
    name: 'msgs-dev-export',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev_export', (req, res) => {
        const send = (status: number, body: string, type = 'application/json') => {
          res.statusCode = status;
          res.setHeader('Content-Type', type);
          res.end(body);
        };
        if (!exportDir || !fs.existsSync(exportDir)) return send(404, JSON.stringify({ error: 'MSGS_EXPORT_DIR not set' }));
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (url.pathname === '/manifest') {
          return send(200, JSON.stringify({ root: path.basename(exportDir), files: listMessageFiles(exportDir) }));
        }
        if (url.pathname === '/media') {
          // A media uri is relative to one of the parts, but not which one: try each.
          const uri = url.searchParams.get('u') ?? '';
          if (!/^your_(facebook|instagram)_activity\//.test(uri) || uri.includes('..')) return send(403, '{}');
          const full = partRoots(exportDir).map((p) => path.join(p, uri)).find((f) => fs.existsSync(f));
          if (!full) return send(404, '{}');
          const type = MEDIA_TYPES[path.extname(full).slice(1).toLowerCase()] ?? 'application/octet-stream';
          const size = fs.statSync(full).size;
          res.setHeader('Content-Type', type);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Cache-Control', 'private, max-age=3600');
          // Videos seek with Range requests.
          const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
          if (range) {
            const start = range[1] ? Number(range[1]) : 0;
            const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
            res.statusCode = 206;
            res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
            res.setHeader('Content-Length', String(end - start + 1));
            return fs.createReadStream(full, { start, end }).pipe(res);
          }
          res.setHeader('Content-Length', String(size));
          return fs.createReadStream(full).pipe(res);
        }
        if (url.pathname === '/file') {
          const rel = url.searchParams.get('p') ?? '';
          const full = path.resolve(exportDir, rel);
          if (!full.startsWith(path.resolve(exportDir) + path.sep) || !isMessageFile(full)) return send(403, '{}');
          res.setHeader('Content-Type', 'application/json');
          return fs.createReadStream(full).on('error', () => send(404, '{}')).pipe(res);
        }
        send(404, '{}');
      });
    },
  };
}
