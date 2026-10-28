/// <reference lib="webworker" />
import { datasetToIPC } from './arrow';
import { ExportBuilder } from './parse';
import type { RawThreadFile } from './types';
import type { Source, WorkerRequest, WorkerResponse } from './protocol';

const post = (msg: WorkerResponse, transfer: Transferable[] = []) => self.postMessage(msg, transfer);
const READ_CONCURRENCY = 8;

async function read(src: Source): Promise<string> {
  if ('file' in src) return src.file.text();
  const res = await fetch(src.url);
  if (!res.ok) throw new Error(`${res.status} fetching ${src.path}`);
  return res.text();
}

async function parse(sources: Source[]) {
  const started = performance.now();
  const builder = new ExportBuilder();
  let next = 0;
  let done = 0;
  // Reads overlap; JSON.parse + addFile run one at a time on this thread.
  const lane = async () => {
    while (next < sources.length) {
      const src = sources[next++];
      const raw = JSON.parse(await read(src)) as RawThreadFile;
      builder.addFile(raw, src.path);
      done++;
      if (done % 10 === 0 || done === sources.length) {
        post({ type: 'progress', done, total: sources.length, messages: builder.rawMessages });
      }
    }
  };
  await Promise.all(Array.from({ length: READ_CONCURRENCY }, lane));

  const ds = builder.build();
  const ipc = datasetToIPC(ds);
  post(
    {
      type: 'done',
      ipc,
      summary: {
        owner: ds.owner,
        files: ds.files,
        rawMessages: builder.rawMessages,
        messages: ds.messages.message_id.length,
        threads: ds.threads.thread_id.length,
        parseMs: performance.now() - started,
      },
    },
    Object.values(ipc).map((b) => b.buffer),
  );
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  parse(e.data.sources).catch((err: unknown) => post({ type: 'error', message: String(err instanceof Error ? err.message : err) }));
};
