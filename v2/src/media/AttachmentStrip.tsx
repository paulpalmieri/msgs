// A message's attachments as a row of thumbnails; click one to open the
// message's media in the viewer.
import { useLightbox } from './Lightbox';
import { Thumb, type MediaType } from './Thumb';

export type Attachment = { t: MediaType; u: string };

export function AttachmentStrip({ message, attachments, size = 112, max = 6 }: {
  message: { message_id: number; ts: number; sender: string; text?: string | null; n_reactions?: number };
  attachments: Attachment[];
  size?: number;
  max?: number;
}) {
  const lightbox = useLightbox();
  if (!attachments.length) return null;
  const items = attachments.map((a) => ({ ...message, uri: a.u, type: a.t }));
  const shown = attachments.slice(0, max);
  const more = attachments.length - shown.length;
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {shown.map((a, i) => {
        const small = a.t === 'sticker' || a.t === 'audio' || a.t === 'file';
        const s = small ? Math.round(size * 0.6) : size;
        return (
          <div key={a.u} className="relative" style={{ width: s, height: s }}>
            <Thumb uri={a.u} type={a.t} className="h-full w-full" onClick={() => lightbox.open(items, i)} />
            {i === shown.length - 1 && more > 0 && (
              <button onClick={() => lightbox.open(items, i + 1)} className="absolute inset-0 flex items-center justify-center rounded-md bg-black/55 text-[15px] font-semibold text-white">
                +{more}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
