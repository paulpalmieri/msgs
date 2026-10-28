import { describe, expect, it } from 'vitest';
import { ExportBuilder } from '../ingest/parse';
import { DEMO_OWNER, demoFiles } from './generate';

describe('demo export', () => {
  it('parses like a real export', async () => {
    const t0 = performance.now();
    const files = demoFiles();
    const b = new ExportBuilder();
    for (const f of files) b.addFile(JSON.parse(await f.file.text()), f.path);
    const ds = b.build();
    const ms = performance.now() - t0;

    expect(ds.threads.thread_id.length).toBe(10);
    expect(ds.owner).toBe(DEMO_OWNER);
    expect(ds.messages.text.some((t) => t?.includes('Ã'))).toBe(false);
    expect(ds.messages.sender).toContain('Léa Fontaine');

    const perThread = new Map<number, number>();
    for (const t of ds.messages.thread_id) perThread.set(t, (perThread.get(t) ?? 0) + 1);
    const kinds: Record<string, number> = {};
    for (const k of ds.messages.kind) kinds[k] = (kinds[k] ?? 0) + 1;
    const titles = ds.threads.title.map((title, i) => `${title}: ${perThread.get(i) ?? 0}`);
    console.log({ files: files.length, messages: ds.messages.message_id.length, reactions: ds.reactions.actor.length, attachments: ds.attachments.uri.length, kinds, titles, ms: Math.round(ms) });

    const big = Math.max(...perThread.values());
    expect(big).toBeGreaterThan(30_000);
    expect(ds.threads.category).toEqual(expect.arrayContaining(['inbox', 'archived_threads', 'e2ee_cutover', 'message_requests']));
  });
});
