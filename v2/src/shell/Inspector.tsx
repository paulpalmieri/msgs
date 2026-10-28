// Right-hand drill-down: the actual messages behind whatever was clicked.
import { BookOpen, X } from 'lucide-react';
import { useEffect } from 'react';
import { useConversation } from '../app/ConversationProvider';
import { useQuery } from '../db/useQuery';
import { AttachmentStrip } from '../media/AttachmentStrip';
import { fmtInt } from '../lib/format';

const LIMIT = 500;
const tf = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

interface MsgRow extends Record<string, unknown> {
  message_id: number;
  ts: number;
  sender: string;
  kind: string;
  text: string | null;
  link: string | null;
  n_attachments: number;
  call_duration: number | null;
  reactions: string | null;
  attachments: string | null;
}

export function messagesSql(where: string, from: 'sel' | 'ctx' | 'span' = 'sel', limit = LIMIT) {
  return `
    SELECT m.message_id, epoch_ms(m.ts) AS ts, m.sender, m.kind, m.text, m.link, m.n_attachments, m.call_duration,
           (SELECT string_agg(reaction, '') FROM reactions r WHERE r.message_id = m.message_id) AS reactions,
           (SELECT to_json(list({'t': type, 'u': uri} ORDER BY uri))::VARCHAR FROM attachments a WHERE a.message_id = m.message_id) AS attachments
    FROM ${from} m WHERE ${where} ORDER BY m.ts LIMIT ${limit}`;
}

export function MessageRow({ m, onOpen }: { m: MsgRow; onOpen?: (messageId: number) => void }) {
  const { colorOf } = useConversation();
  const body =
    m.text ??
    (m.kind === 'call' ? `Call · ${Math.round((m.call_duration ?? 0) / 60)} min` : m.link ?? `${m.kind}${m.n_attachments > 1 ? ` ×${m.n_attachments}` : ''}`);
  return (
    <div className="group border-b border-line/60 px-4 py-2">
      <div className="flex items-center gap-2 text-[11px]">
        <span className="h-3 w-0.5 rounded-full" style={{ background: colorOf(m.sender) }} />
        <span className="font-medium text-ink">{m.sender}</span>
        {onOpen && (
          <button onClick={() => onOpen(m.message_id)} title="Read it in context" className="invisible inline-flex items-center gap-1 text-accent group-hover:visible">
            <BookOpen size={11} /> in context
          </button>
        )}
        <span className="num ml-auto text-ink-3">{tf.format(new Date(m.ts))}</span>
      </div>
      {(m.text || !m.attachments) && <div className={`mt-0.5 whitespace-pre-wrap break-words pl-2.5 ${m.text ? '' : 'italic text-ink-3'}`}>{body}</div>}
      {m.attachments && <div className="pl-2.5"><AttachmentStrip message={m} attachments={JSON.parse(m.attachments)} size={84} max={4} /></div>}
      {m.reactions && <div className="mt-0.5 pl-2.5 text-[12px]">{m.reactions}</div>}
    </div>
  );
}

export function Inspector({ onOpen }: { onOpen: (messageId: number) => void }) {
  const { inspection, inspect } = useConversation();
  const where = inspection?.where ?? 'FALSE';
  const from = inspection?.from ?? 'sel';
  const rows = useQuery<MsgRow>(inspection ? messagesSql(where, from) : null);
  const total = useQuery<{ n: number }>(inspection ? `SELECT count(*) AS n FROM ${from} WHERE ${where}` : null).data?.[0]?.n;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && inspect(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspect]);

  if (!inspection) return null;
  return (
    <aside className="flex w-[400px] shrink-0 flex-col border-l border-line bg-surface">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-4">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{inspection.title}</div>
        </div>
        <span className="num text-[11px] text-ink-3">{total !== undefined && `${fmtInt(total)} messages`}</span>
        <button onClick={() => inspect(null)} className="rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-ink" title="Close (Esc)">
          <X size={15} />
        </button>
      </header>
      <div className={`min-h-0 flex-1 overflow-auto transition-opacity ${rows.loading ? 'opacity-50' : ''}`}>
        {rows.error && <div className="p-4 font-mono text-[12px] text-danger">{rows.error}</div>}
        {rows.data?.map((m) => <MessageRow key={m.message_id} m={m} onOpen={onOpen} />)}
        {total !== undefined && total > LIMIT && <div className="p-4 text-center text-[11px] text-ink-3">Showing the first {LIMIT} of {fmtInt(total)}. Narrow the filters to see more.</div>}
        {rows.data?.length === 0 && <div className="p-4 text-ink-3">No messages.</div>}
      </div>
    </aside>
  );
}
