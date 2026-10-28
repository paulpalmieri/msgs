import fs from 'node:fs';
import path from 'node:path';
import { tableFromIPC } from 'apache-arrow';
import { describe, expect, it } from 'vitest';
import { datasetToIPC } from './arrow';
import { ExportBuilder } from './parse';
import { isMessageFile, isRelevantPath, shouldDescend } from './paths';
import { countWords, fixText, isCaptionText, isSystemText } from './text';
import type { RawThreadFile } from './types';

const mojibake = (s: string) => String.fromCharCode(...new TextEncoder().encode(s));

describe('text', () => {
  it('repairs Facebook mojibake and leaves clean text alone', () => {
    expect(fixText(mojibake('Ça va ? 😂'))).toBe('Ça va ? 😂');
    expect(fixText('plain ascii')).toBe('plain ascii');
    expect(fixText('déjà 😂')).toBe('déjà 😂');
  });
  it('classifies system messages and captions', () => {
    expect(isSystemText('Alice added Bob to the group.')).toBe(true);
    expect(isSystemText('A contact added Bob and 3 others to the group.')).toBe(true);
    expect(isSystemText('Bob left the group.')).toBe(true);
    expect(isSystemText('I left the party early')).toBe(false);
    expect(isCaptionText('Alice sent an attachment.')).toBe(true);
    expect(isCaptionText('You sent a link.')).toBe(true);
  });
  it('counts words', () => {
    expect(countWords('  hello  there 😂 !! ')).toBe(2);
  });
});

describe('paths', () => {
  it('prunes media and non-message folders', () => {
    expect(shouldDescend('photos', 'alice_123')).toBe(false);
    expect(shouldDescend('posts', 'your_facebook_activity')).toBe(false);
    expect(shouldDescend('messages', 'your_facebook_activity')).toBe(true);
    expect(isMessageFile('x/your_facebook_activity/messages/inbox/alice_1/message_2.json')).toBe(true);
    expect(isMessageFile('x/your_facebook_activity/messages/secret_conversations.json')).toBe(false);
    expect(isRelevantPath('x/your_facebook_activity/messages/inbox/alice_1/photos/message_1.json')).toBe(false);
  });
});

const fixture = (messages: RawThreadFile['messages']): RawThreadFile => ({
  title: mojibake('Équipe'),
  thread_path: 'inbox/team_1',
  participants: [{ name: 'Me' }, { name: 'Alice' }],
  messages,
});

describe('ExportBuilder', () => {
  it('merges chunks, dedupes, orders, and classifies', () => {
    const b = new ExportBuilder();
    b.addFile(fixture([
      { sender_name: 'Alice', timestamp_ms: 3000, content: 'Alice sent an attachment.', photos: [{ uri: 'a.jpg' }, { uri: 'b.jpg' }] },
      { sender_name: 'Me', timestamp_ms: 2000, content: 'You called Alice.', call_duration: 61 },
    ]), 'f/your_facebook_activity/messages/inbox/team_1/message_1.json');
    b.addFile(fixture([
      { sender_name: 'Me', timestamp_ms: 2000, content: 'You called Alice.', call_duration: 61 },
      { sender_name: 'Alice', timestamp_ms: 1000, content: mojibake('salut ça va'), reactions: [{ reaction: mojibake('❤️'), actor: 'Me' }] },
    ]), 'g/your_facebook_activity/messages/inbox/team_1/message_2.json');
    // A second owner thread so "Me" wins owner detection.
    b.addFile({ thread_path: 'inbox/solo_2', participants: [{ name: 'Me' }, { name: 'Bob' }], messages: [] }, 'p');

    const ds = b.build();
    expect(ds.owner).toBe('Me');
    expect(ds.threads.title[1]).toBe('Équipe');
    expect([...ds.messages.ts_ms]).toEqual([1000, 2000, 3000]);
    expect(ds.messages.kind).toEqual(['text', 'call', 'photo']);
    expect(ds.messages.text).toEqual(['salut ça va', null, null]);
    expect([...ds.messages.words]).toEqual([3, 0, 0]);
    expect(ds.messages.is_me).toEqual([false, true, false]);
    expect(ds.messages.call_duration).toEqual([null, 61, null]);
    expect([...ds.messages.n_attachments]).toEqual([0, 0, 2]);
    expect(ds.reactions.reaction).toEqual(['❤️']);

    const anon = new ExportBuilder();
    anon.addFile({ thread_path: 'inbox/x_3', participants: [{ name: '' }], messages: [{ sender_name: '', timestamp_ms: 1, content: 'hi' }] }, 'p');
    expect(anon.build().messages.sender).toEqual(['Facebook user']);

    const ipc = datasetToIPC(ds);
    const t = tableFromIPC(ipc.messages);
    expect(t.numRows).toBe(3);
    expect(t.getChild('text')?.toArray()).toEqual(['salut ça va', null, null]);
  });
});

const exportDir = process.env.MSGS_EXPORT_DIR;
describe.skipIf(!exportDir || !fs.existsSync(exportDir))('real export', () => {
  it('parses every thread', () => {
    const b = new ExportBuilder();
    const walk = (dir: string, parent?: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) shouldDescend(e.name, parent) && walk(full, e.name);
        else if (isMessageFile(full)) b.addFile(JSON.parse(fs.readFileSync(full, 'utf8')), full);
      }
    };
    const t0 = performance.now();
    walk(exportDir!);
    const ds = b.build();
    const ms = performance.now() - t0;
    const kinds: Record<string, number> = {};
    for (const k of ds.messages.kind) kinds[k] = (kinds[k] ?? 0) + 1;
    const ipc = datasetToIPC(ds);
    console.log({ files: ds.files, threads: ds.threads.thread_id.length, messages: ds.messages.message_id.length,
      reactions: ds.reactions.actor.length, attachments: ds.attachments.uri.length, owner: ds.owner, kinds, ms: Math.round(ms),
      ipcMB: Object.fromEntries(Object.entries(ipc).map(([k, v]) => [k, +(v.byteLength / 1e6).toFixed(1)])) });
    expect(ds.messages.message_id.length).toBe(b.rawMessages);
    expect(ds.messages.text.some((t) => t?.includes('Ã'))).toBe(false);
  });
});
