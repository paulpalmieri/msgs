import type { Attachment } from './AttachmentStrip';
import { Thumb } from './Thumb';

/** A message in a list: its text, with a small preview of its first attachment. */
export function MessagePreview({ text, kind, atts }: { text: string | null; kind: string; atts: string | null }) {
  const list: Attachment[] = atts ? JSON.parse(atts) ?? [] : [];
  const first = list[0];
  return (
    <span className="flex min-w-0 flex-1 items-start gap-2">
      {first && <Thumb uri={first.u} type={first.t} className="size-14 shrink-0" />}
      <span className={`min-w-0 flex-1 ${text ? '' : 'italic text-ink-3'}`}>
        {text ?? (first ? (list.length > 1 ? `${list.length} ${kind}s` : kind) : kind)}
      </span>
    </span>
  );
}
