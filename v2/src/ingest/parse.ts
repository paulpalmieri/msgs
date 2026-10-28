// Turns message_N.json files into column arrays. Pure: runs in the parser
// worker and in Node tests.
import { countWords, fixText, isCaptionText, isSystemText } from './text';
import type { AttachmentType, MessageKind, ParsedDataset, RawMessage, RawThreadFile } from './types';

interface ThreadAcc {
  key: string;
  title: string;
  category: string;
  platform: string;
  isStillParticipant: boolean;
  participants: Set<string>;
  messages: RawMessage[];
  seen: Set<string>;
}

/** Deleted accounts come through with an empty name; Messenger shows them as "Facebook user". */
const personName = (raw: string | undefined) => fixText(raw ?? '').trim() || 'Facebook user';

function kindOf(m: RawMessage, content: string | null): MessageKind {
  if (m.is_unsent) return 'unsent';
  if (m.call_duration !== undefined) return 'call';
  if (m.photos?.length) return 'photo';
  if (m.videos?.length) return 'video';
  if (m.gifs?.length) return 'gif';
  if (m.audio_files?.length) return 'audio';
  if (m.files?.length) return 'file';
  if (m.sticker) return 'sticker';
  if (m.share) return 'link';
  if (content) return isSystemText(content) ? 'system' : 'text';
  return 'other';
}

export class ExportBuilder {
  private threads = new Map<string, ThreadAcc>();
  files = 0;
  rawMessages = 0;

  /** `sourcePath` is the file's path inside the export, used to tell platforms apart. */
  addFile(raw: RawThreadFile, sourcePath: string): void {
    this.files++;
    const platform = /your_instagram_activity/.test(sourcePath) ? 'instagram' : 'facebook';
    const key = platform === 'facebook' ? raw.thread_path : `ig:${raw.thread_path}`;
    let t = this.threads.get(key);
    if (!t) {
      t = {
        key,
        title: fixText(raw.title ?? ''),
        category: raw.thread_path.split('/')[0] ?? 'inbox',
        platform,
        isStillParticipant: raw.is_still_participant ?? true,
        participants: new Set(),
        messages: [],
        seen: new Set(),
      };
      this.threads.set(key, t);
    }
    for (const p of raw.participants ?? []) t.participants.add(personName(p.name));
    // Files list newest first; reversing keeps same-millisecond messages in order.
    for (let i = raw.messages.length - 1; i >= 0; i--) {
      const m = raw.messages[i];
      this.rawMessages++;
      const dedupeKey = `${m.timestamp_ms}|${m.sender_name}|${m.content ?? ''}`;
      if (t.seen.has(dedupeKey)) continue;
      t.seen.add(dedupeKey);
      t.messages.push(m);
    }
  }

  build(): ParsedDataset {
    const threads = [...this.threads.values()].sort((a, b) => a.key.localeCompare(b.key));
    const owner = detectOwner(threads);
    const total = threads.reduce((n, t) => n + t.messages.length, 0);

    const out: ParsedDataset = {
      owner,
      files: this.files,
      threads: {
        thread_id: new Int32Array(threads.length),
        thread_key: [], title: [], category: [], platform: [], is_still_participant: [],
        participant_count: new Int32Array(threads.length),
      },
      participants: { thread_id: new Int32Array(0), name: [] },
      messages: {
        message_id: new Int32Array(total),
        thread_id: new Int32Array(total),
        ts_ms: new Float64Array(total),
        ts_local_ms: new Float64Array(total),
        sender: [], is_me: [], kind: [], text: [],
        chars: new Int32Array(total),
        words: new Int32Array(total),
        n_attachments: new Int32Array(total),
        link: [], call_duration: [], call_missed: [],
        n_reactions: new Int32Array(total),
      },
      reactions: { message_id: new Int32Array(0), thread_id: new Int32Array(0), actor: [], reaction: [], ts_ms: [] },
      attachments: { message_id: new Int32Array(0), thread_id: new Int32Array(0), type: [], uri: [] },
    };

    const partThread: number[] = [];
    const reactMsg: number[] = [];
    const reactThread: number[] = [];
    const attMsg: number[] = [];
    const attThread: number[] = [];
    const senderCache = new Map<string, string>();
    const M = out.messages;
    let id = 0;

    threads.forEach((t, tid) => {
      out.threads.thread_id[tid] = tid;
      out.threads.thread_key.push(t.key);
      out.threads.title.push(t.title);
      out.threads.category.push(t.category);
      out.threads.platform.push(t.platform);
      out.threads.is_still_participant.push(t.isStillParticipant);
      out.threads.participant_count[tid] = t.participants.size;
      for (const name of t.participants) {
        partThread.push(tid);
        out.participants.name.push(name);
      }

      const msgs = t.messages.slice().sort((a, b) => a.timestamp_ms - b.timestamp_ms);
      for (const m of msgs) {
        let sender = senderCache.get(m.sender_name);
        if (sender === undefined) senderCache.set(m.sender_name, (sender = personName(m.sender_name)));
        const content = m.content ? fixText(m.content) : null;
        const kind = kindOf(m, content);
        const text = content && kind !== 'call' && kind !== 'unsent' && !isCaptionText(content) ? content : null;
        const counted = text !== null && kind !== 'system';

        M.message_id[id] = id;
        M.thread_id[id] = tid;
        M.ts_ms[id] = m.timestamp_ms;
        M.ts_local_ms[id] = m.timestamp_ms - new Date(m.timestamp_ms).getTimezoneOffset() * 60_000;
        M.sender.push(sender);
        M.is_me.push(sender === owner);
        M.kind.push(kind);
        M.text.push(text);
        M.chars[id] = counted ? text.length : 0;
        M.words[id] = counted ? countWords(text) : 0;
        M.link.push(m.share?.link ? fixText(m.share.link) : null);
        M.call_duration.push(kind === 'call' ? m.call_duration ?? 0 : null);
        M.call_missed.push(kind === 'call' ? m.missed ?? false : null);
        M.n_reactions[id] = m.reactions?.length ?? 0;

        for (const r of m.reactions ?? []) {
          reactMsg.push(id);
          reactThread.push(tid);
          out.reactions.actor.push(personName(r.actor));
          out.reactions.reaction.push(fixText(r.reaction));
          out.reactions.ts_ms.push(r.timestamp ? r.timestamp * 1000 : null);
        }

        let n = 0;
        const addAtt = (type: AttachmentType, list: { uri: string }[] | undefined) => {
          for (const a of list ?? []) {
            attMsg.push(id);
            attThread.push(tid);
            out.attachments.type.push(type);
            out.attachments.uri.push(a.uri);
            n++;
          }
        };
        addAtt('photo', m.photos);
        addAtt('video', m.videos);
        addAtt('gif', m.gifs);
        addAtt('audio', m.audio_files);
        addAtt('file', m.files);
        addAtt('sticker', m.sticker ? [m.sticker] : undefined);
        M.n_attachments[id] = n;
        id++;
      }
    });

    out.participants.thread_id = Int32Array.from(partThread);
    out.reactions.message_id = Int32Array.from(reactMsg);
    out.reactions.thread_id = Int32Array.from(reactThread);
    out.attachments.message_id = Int32Array.from(attMsg);
    out.attachments.thread_id = Int32Array.from(attThread);
    return out;
  }
}

/** The export owner is in every thread they were part of: the most common participant. */
function detectOwner(threads: ThreadAcc[]): string | null {
  const counts = new Map<string, number>();
  for (const t of threads) for (const p of t.participants) counts.set(p, (counts.get(p) ?? 0) + 1);
  let best: string | null = null;
  let max = 0;
  for (const [name, n] of counts) if (n > max) [best, max] = [name, n];
  return best;
}
