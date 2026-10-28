// Dev-only: serves the message JSON of a local export so the app can load it
// without picking a 29 GB folder each time. Never active in production builds.
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
