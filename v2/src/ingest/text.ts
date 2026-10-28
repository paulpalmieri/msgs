// Text normalisation for Facebook exports.

const utf8 = new TextDecoder('utf-8');

/**
 * Facebook writes UTF-8 bytes as individual \u00XX code points ("Ã©" for "é").
 * A correctly encoded string never has only code points <= 0xFF with some in
 * 0x80–0xFF, so that pattern is safe to re-decode.
 */
export function fixText(s: string): string {
  let needs = false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c > 0xff) return s;
    if (c >= 0x80) needs = true;
  }
  if (!needs) return s;
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return utf8.decode(bytes);
}

// Messages Facebook generates itself (group membership, settings, ...).
const SYSTEM_PATTERNS: RegExp[] = [
  / added .+ to the group\.$/,
  / added (you|a participant)( and .+)?( to the group)?\.$/,
  / (left|joined) the group\.$/,
  / removed .+ from the group\.$/,
  / (added|removed) .+ as a group admin\.$/,
  / (set|cleared) (the|his|her|their|your) (own )?nickname/,
  / (named the group|changed the group name to) /,
  / removed the group name\.$/,
  / (changed|removed) the group photo\.$/,
  / changed the (chat )?theme/,
  / (set|changed) the (quick reaction|emoji)/,
  / turned (on|off) member approval/,
  / created the group\.?$/,
  / (pinned|unpinned) a message\.$/,
  / (created a poll|voted for|changed (his|her|their|your) vote)/,
  / reacted .+ to your message ?$/,
  /^You are now connected on Messenger\.?$/,
  /^You can now (message and call|call and message) each other/,
  /^Say hi to your new Facebook friend/,
];

// Captions Facebook adds to attachments, links and calls in place of text.
const CAPTION_PATTERNS: RegExp[] = [
  /^.+ sent (an attachment|a link|a photo|\d+ photos|a video|\d+ videos|a GIF|a sticker|a voice message|an audio clip|a location)\.$/,
  /^.+ unsent a message\.?$/,
];

export function isSystemText(s: string): boolean {
  return SYSTEM_PATTERNS.some((re) => re.test(s));
}

export function isCaptionText(s: string): boolean {
  return CAPTION_PATTERNS.some((re) => re.test(s));
}

const WORD = /[\p{L}\p{N}]/u;

export function countWords(s: string): number {
  let n = 0;
  for (const token of s.split(/\s+/)) if (WORD.test(token)) n++;
  return n;
}
