// Placeholder media for the demo, drawn on the fly from each file's name so
// the same attachment always looks the same. Photos, GIFs, stickers and video
// posters are SVG images; voice notes are a short generated tone.
import type { MediaSource } from '../media/sources';

const SCENES = ['🏔️', '🍕', '🐶', '🏖️', '🎉', '🌆', '☕', '🐱', '🎸', '🌮', '🚲', '🌅', '🎂', '🏟️', '🍣', '🌲', '🎡', '🛶'];
const SKIES = [['#ff9a8b', '#ff6a88'], ['#a1c4fd', '#c2e9fb'], ['#fbc2eb', '#a6c1ee'], ['#84fab0', '#8fd3f4'], ['#fccb90', '#d57eeb'],
  ['#f6d365', '#fda085'], ['#5ee7df', '#b490ca'], ['#c3cfe2', '#f5f7fa'], ['#43e97b', '#38f9d7'], ['#fa709a', '#fee140']];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const svg = (body: string, w = 600, h = 450) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`)}`;

function picture(uri: string, kind: 'photo' | 'gif' | 'video' | 'sticker'): string {
  const h = hash(uri);
  const [a, b] = SKIES[h % SKIES.length];
  const scene = SCENES[(h >>> 8) % SCENES.length];
  if (kind === 'sticker') {
    return svg(`<text x="150" y="190" font-size="170" text-anchor="middle">${scene}</text>`, 300, 300);
  }
  const portrait = kind === 'photo' && (h >>> 16) % 3 === 0;
  const [w, hh] = portrait ? [450, 600] : [600, 450];
  const grad = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${w}" height="${hh}" fill="url(#g)"/>`;
  const hills = `<path d="M0 ${hh * 0.78} Q ${w * 0.3} ${hh * 0.6} ${w * 0.55} ${hh * 0.74} T ${w} ${hh * 0.7} V ${hh} H 0 Z" fill="#ffffff" opacity="0.28"/>`;
  const icon = kind === 'gif'
    ? `<text x="${w / 2}" y="${hh / 2 + 50}" font-size="150" text-anchor="middle">${scene}<animateTransform attributeName="transform" type="rotate" values="-12 ${w / 2} ${hh / 2};12 ${w / 2} ${hh / 2};-12 ${w / 2} ${hh / 2}" dur="1.2s" repeatCount="indefinite"/></text>`
    : `<text x="${w / 2}" y="${hh / 2 + 50}" font-size="150" text-anchor="middle">${scene}</text>`;
  const play = kind === 'video'
    ? `<circle cx="${w / 2}" cy="${hh / 2}" r="54" fill="#000" opacity="0.45"/><path d="M ${w / 2 - 16} ${hh / 2 - 26} L ${w / 2 + 28} ${hh / 2} L ${w / 2 - 16} ${hh / 2 + 26} Z" fill="#fff"/>`
    : '';
  const tag = `<text x="18" y="${hh - 18}" font-family="system-ui, sans-serif" font-size="18" fill="#fff" opacity="0.85">demo ${kind}</text>`;
  return svg(grad + hills + icon + play + tag, w, hh);
}

let tone: string | null = null;
/** A two-second soft chime as a WAV, made once. */
function voiceNote(): string {
  if (tone) return tone;
  const rate = 16000, secs = 2, n = rate * secs;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const s = (Math.sin(2 * Math.PI * 523 * t) + 0.5 * Math.sin(2 * Math.PI * 784 * t)) * Math.exp(-1.6 * t) * 0.35;
    v.setInt16(44 + i * 2, s * 32767, true);
  }
  tone = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  return tone;
}

let doc: string | null = null;
function file(): string {
  doc ??= URL.createObjectURL(new Blob(['This is a placeholder file from the MSGS demo. Nothing here is real.'], { type: 'text/plain' }));
  return doc;
}

export function demoSource(): MediaSource {
  return {
    kind: 'demo',
    async url(uri) {
      if (uri.includes('/stickers_used/')) return picture(uri, 'sticker');
      if (uri.includes('/photos/')) return picture(uri, 'photo');
      if (uri.includes('/gifs/')) return picture(uri, 'gif');
      if (uri.includes('/videos/')) return picture(uri, 'video');
      if (uri.includes('/audio/')) return voiceNote();
      if (uri.includes('/files/')) return file();
      return null;
    },
  };
}

/** Demo videos are poster images; real ones are video files. */
export const isImageUrl = (url: string) => url.startsWith('data:image/');
