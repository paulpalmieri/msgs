// Person colours for any group size. The 8 validated hues come first, in
// their validated order; then the same hues one step darker and one step
// lighter (OKLCH), so neighbours in rank order always differ in hue. Past 24
// people colours repeat: every person also has an initials badge, and
// legends, tooltips and labels always name them.

type Lch = [number, number, number];

function srgbToLinear(c: number) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function linearToSrgb(c: number) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

function hexToOklch(hex: string): Lch {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => srgbToLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}

function oklchToHex([L, C, H]: Lch): string {
  // Reduce chroma until the colour fits in sRGB.
  for (let c = C; c >= 0; c -= 0.005) {
    const A = c * Math.cos(H), B = c * Math.sin(H);
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    const rgb = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    if (rgb.every((v) => v >= -0.0005 && v <= 1.0005)) {
      return '#' + rgb.map((v) => Math.round(Math.min(1, Math.max(0, linearToSrgb(v))) * 255).toString(16).padStart(2, '0')).join('');
    }
  }
  return '#888888';
}

/** Lightness offsets per tier; the first tier is the validated palette itself. */
// Dark mode's band is narrower, so its steps are smaller.
const TIERS = { light: [0, -0.12, 0.12], dark: [0, -0.075, 0.075] };
/** OKLCH lightness bands the dataviz validator accepts for series colours. */
const BAND = { light: [0.44, 0.76], dark: [0.49, 0.66] };

/**
 * 24 person colours: the 8 validated hues, then the same hues one step darker,
 * then one step lighter, all kept inside the mode's lightness band (a step
 * the band can't hold is taken twice in the other direction instead).
 */
export function extendPalette(base: string[], dark: boolean): string[] {
  const [lo, hi] = dark ? BAND.dark : BAND.light;
  const out: string[] = [];
  for (const t of dark ? TIERS.dark : TIERS.light) {
    for (const hex of base) {
      if (t === 0) {
        out.push(hex);
        continue;
      }
      const [L, C, H] = hexToOklch(hex);
      // Clamp into the band; if that leaves too small a step, go the other way instead.
      let target = Math.min(hi, Math.max(lo, L + t));
      if (Math.abs(target - L) < Math.abs(t) / 2) target = L - 2 * t;
      let hex2 = oklchToHex([Math.min(hi, Math.max(lo, target)), Math.max(C, 0.12), H]);
      // Gamut mapping can drain chroma at the dark end (greens): step back toward the middle.
      if (hexToOklch(hex2)[1] < 0.1) hex2 = oklchToHex([Math.min(hi, Math.max(lo, target + (target < L ? 0.05 : -0.05))), Math.max(C, 0.12), H]);
      out.push(hex2);
    }
  }
  return out;
}

/** Up to two initials, e.g. "Ada Lovelace" → "AL", "Rob" → "RO". */
export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Black or white, whichever reads better on the colour. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => srgbToLinear(v / 255));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.32 ? '#0b0b0b' : '#ffffff';
}
