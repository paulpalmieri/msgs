// A fictional Messenger export, generated in the browser and fed through the
// real import pipeline (mojibake encoding, files split across export parts,
// system messages, calls, links, media, reactions), so the demo exercises
// exactly what a real import does. Everything is seeded: same demo every time.
//
// Ten conversations: one big group over five years with six people (where the
// interesting structure lives: phases, a lockdown-style peak, a duo, a night
// owl, a photographer, someone everyone laughs at), plus smaller 1:1s and groups.
import type { RawMessage, RawThreadFile } from '../ingest/types';

export const DEMO_LABEL = 'Demo · fictional data';
export const DEMO_OWNER = 'Alex Morgan';

// --- Seeded randomness ---------------------------------------------------------------

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
const pick = <T,>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
function weighted<T>(r: Rand, xs: readonly T[], w: (x: T) => number): T {
  const total = xs.reduce((s, x) => s + w(x), 0);
  let u = r() * total;
  for (const x of xs) if ((u -= w(x)) <= 0) return x;
  return xs[xs.length - 1];
}
function poisson(r: Rand, mean: number): number {
  if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * gauss(r)));
  const L = Math.exp(-mean);
  let k = 0, p = 1;
  do { k++; p *= r(); } while (p > L);
  return k - 1;
}
function gauss(r: Rand): number {
  return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
}
const expo = (r: Rand, mean: number) => -Math.log(1 - r()) * mean;

/** Facebook writes UTF-8 bytes as \u00XX code points; do the same so the parser's repair runs. */
const mojibake = (s: string) => String.fromCharCode(...new TextEncoder().encode(s));

// --- People ------------------------------------------------------------------------------

interface Persona {
  name: string;
  /** Relative share of messages. */
  weight: number;
  /** Hour of the day they're most active (local). */
  peak: number;
  /** Extra activity late at night (0–1). */
  owl: number;
  /** Median seconds before replying. */
  replySec: number;
  /** Chance the next message is theirs again (double texting). */
  burst: number;
  /** How likely others react to their messages (1 = average). */
  funny: number;
  /** How much they react to others (1 = average). */
  generous: number;
  emoji: number;
  photo: number;
  link: number;
  words: number;
  sig: string[];
  reacts: string[];
}

const P = (p: Partial<Persona> & { name: string }): Persona => ({
  weight: 1, peak: 20, owl: 0.1, replySec: 90, burst: 0.25, funny: 1, generous: 1, emoji: 0.12, photo: 0.03, link: 0.015, words: 7,
  sig: [], reacts: ['😆', '❤️', '👍'], ...p,
});

const ALEX = P({ name: DEMO_OWNER, weight: 1, peak: 21, replySec: 70, funny: 1.9, generous: 0.8, sig: ['classic', 'deal', 'noted'], reacts: ['😆', '😆', '❤️', '😮'] });
const CREW = [
  ALEX,
  P({ name: 'Sam Rivera', weight: 1.9, peak: 22, owl: 0.35, replySec: 35, burst: 0.45, funny: 0.8, generous: 0.7, emoji: 0.2, words: 5, sig: ['bro', 'legend', 'vibes'], reacts: ['😆', '🔥', '😆'] }),
  P({ name: 'Jordan Lee', weight: 1.4, peak: 13, owl: 0.02, replySec: 240, burst: 0.15, funny: 1.1, generous: 1.6, words: 11, sig: ['literally', 'iconic', 'honestly'], reacts: ['❤️', '😆', '👍', '😍'] }),
  P({ name: 'Camille Roux', weight: 1.1, peak: 19, replySec: 120, funny: 1.2, generous: 1.2, emoji: 0.18, photo: 0.09, sig: ['mdr', 'carrément', 'bisous'], reacts: ['😍', '❤️', '😆'] }),
  P({ name: 'Noah Bennett', weight: 0.8, peak: 8, owl: 0, replySec: 400, burst: 0.1, funny: 0.9, generous: 0.6, link: 0.06, words: 14, sig: ['mate', 'cheers', 'brilliant'], reacts: ['👍', '👍', '😆'] }),
  P({ name: 'Maya Patel', weight: 0.9, peak: 18, replySec: 80, funny: 1, generous: 2.2, emoji: 0.3, sig: ['omg', 'obsessed', 'cute'], reacts: ['❤️', '😍', '😆', '😢'] }),
];
const SOLO = {
  lea: P({ name: 'Léa Fontaine', peak: 20, replySec: 150, sig: ['trop bien', 'grave'], reacts: ['❤️', '😆'] }),
  hugo: P({ name: 'Hugo Valette', peak: 23, owl: 0.4, replySec: 60, sig: ['wesh', 'tkt'], reacts: ['😆', '🔥'] }),
  theo: P({ name: 'Theo Wright', peak: 12, replySec: 600, words: 12, sig: ['indeed', 'grand'], reacts: ['👍'] }),
  ines: P({ name: 'Inès Garnier', peak: 19, replySec: 200, photo: 0.07, sig: ['coucou', 'hâte'], reacts: ['❤️', '😍'] }),
  lucas: P({ name: 'Lucas Moreau', peak: 18, replySec: 120, link: 0.05, sig: ['frère', 'ouf'], reacts: ['😆', '👍'] }),
  zoe: P({ name: 'Zoé Leclerc', peak: 9, replySec: 300, sig: ['merci', 'parfait'], reacts: ['❤️'] }),
  ethan: P({ name: 'Ethan Brooks', peak: 17, replySec: 90, sig: ['gg', 'ez'], reacts: ['😆', '😮'] }),
  nina: P({ name: 'Nina Castillo', peak: 21, replySec: 100, emoji: 0.25, sig: ['jaja', 'amor'], reacts: ['😍', '❤️'] }),
  oscar: P({ name: 'Oscar Lindqvist', peak: 7, replySec: 900, words: 9, sig: ['nice', 'sure'], reacts: ['👍'] }),
  ava: P({ name: 'Ava Thompson', peak: 16, replySec: 150, sig: ['yay', 'lovely'], reacts: ['❤️', '😆'] }),
};

// --- Words -----------------------------------------------------------------------------

const OPENERS = ['hey', 'yo', 'morning', 'ok so', 'guys', 'wait', 'so', 'honestly', 'quick one', 'right'];
const TOPICS = [
  'pizza tonight?', 'that ramen place again', 'brunch sunday?', 'who is cooking tonight', 'tacos at mine', 'the new bakery is amazing',
  'did you watch the game', 'that goal though', 'five a side on thursday', 'running club tomorrow at 7', 'the final is on saturday',
  'drinks friday?', 'weekend plans?', 'road trip in june', 'concert tickets are out', 'beach day if the sun stays', 'movie night at sams',
  'long day at work', 'meeting ran so late', 'deadline tomorrow send help', 'started the new job today', 'coffee break anyone',
  'look at this', 'this is so us', 'no way that happened', 'send pics', 'the playlist is ready', 'found the perfect cabin for the trip',
  'my cat knocked everything off the table', 'the train is late again', 'who wants to book the restaurant', 'birthday plans for maya',
  'karaoke was a mistake', 'i miss the lake house', 'board game night?', 'who took my charger', 'remember the ferry', 'new season is out',
];
const REPLIES = ['haha', 'lol', 'true', 'same', 'agreed', 'omg', 'nooo', 'yes!', '100%', 'wait what', 'fair', 'deal', 'on my way', 'sounds good',
  'count me in', 'i cant', 'stop', 'classic', 'ok', 'ahah', 'no way', 'love it', 'ugh', 'sure', 'lets go'];
const TAILS = ['', '', '', ' honestly', ' tbh', ' or what', ' again', ' this week', ' 🙌', ' 😂', ' lol', ' !!', ' 👀'];
const EMOJI = ['😂', '😅', '🙌', '🔥', '👀', '😍', '🥲', '🎉', '😭', '🤝', '✨', '🍕', '⚽', '🎶'];
const SITES = ['https://www.youtube.com/watch?v=', 'https://open.spotify.com/track/', 'https://www.instagram.com/p/', 'https://www.lemonde.fr/article/',
  'https://www.nytimes.com/2021/', 'https://x.com/status/', 'https://www.airbnb.com/rooms/', 'https://www.imdb.com/title/tt'];

function text(r: Rand, p: Persona, replying: boolean): string {
  let s: string;
  if (replying && r() < 0.45) s = pick(r, REPLIES);
  else if (r() < 0.12) {
    // A longer story, a few sentences.
    s = Array.from({ length: 2 + Math.floor(r() * 3) }, () => `${pick(r, OPENERS)} ${pick(r, TOPICS)}`).join('. ');
  } else {
    s = `${r() < 0.4 ? pick(r, OPENERS) + ' ' : ''}${pick(r, TOPICS)}${pick(r, TAILS)}`;
  }
  if (p.sig.length && r() < 0.28) s = r() < 0.5 ? `${pick(r, p.sig)} ${s}` : `${s} ${pick(r, p.sig)}`;
  if (r() < p.emoji) s += ` ${pick(r, EMOJI)}${r() < 0.3 ? pick(r, EMOJI) : ''}`;
  if (p.words > 10 && r() < 0.3) s += `, ${pick(r, TOPICS)}`;
  return s;
}

// --- Conversation generator ----------------------------------------------------------------

interface Spec {
  slug: string;
  folder: 'inbox' | 'archived_threads' | 'e2ee_cutover' | 'message_requests';
  title: string;
  people: Persona[];
  start: [number, number, number];
  years: number;
  /** Mean messages per day at full intensity. */
  perDay: number;
  /** Activity multiplier over the conversation's life (t from 0 to 1). */
  phase: (t: number, date: Date) => number;
  seed: number;
  calls?: number;
  system?: boolean;
}

let nextId = 1_000_000;
const uid = () => String(nextId++);

function generate(spec: Spec): RawMessage[] {
  const r = rng(spec.seed);
  const out: RawMessage[] = [];
  const isGroup = spec.people.length > 2;
  const start = new Date(spec.start[0], spec.start[1], spec.start[2]);
  const days = Math.round(spec.years * 365);
  const add = (m: RawMessage) => out.push(m);
  const slugDir = `your_facebook_activity/messages/${spec.folder}/${spec.slug}`;
  // Pairs who answer each other more: the big group's duo is Sam & Jordan.
  const affinity = (a: Persona, b: Persona) =>
    (a.name === 'Sam Rivera' && b.name === 'Jordan Lee') || (b.name === 'Sam Rivera' && a.name === 'Jordan Lee') ? 3 : 1;

  if (spec.system && isGroup) {
    const t0 = start.getTime() + 9 * 3600_000;
    add({ sender_name: DEMO_OWNER, timestamp_ms: t0, content: `${DEMO_OWNER} created the group.` });
    spec.people.slice(1).forEach((p, i) => add({ sender_name: DEMO_OWNER, timestamp_ms: t0 + (i + 1) * 60_000, content: `${DEMO_OWNER} added ${p.name} to the group.` }));
    add({ sender_name: DEMO_OWNER, timestamp_ms: t0 + 600_000, content: `${DEMO_OWNER} named the group ${spec.title}.` });
  }

  for (let d = 0; d < days; d++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d);
    const wd = date.getDay();
    const weekend = wd === 0 || wd === 6 ? 1.25 : wd === 5 ? 1.15 : 1;
    const intensity = spec.perDay * spec.phase(d / days, date) * weekend * (0.6 + 0.8 * r());
    let budget = poisson(r, intensity);
    while (budget > 0) {
      // A session: a burst of back-and-forth starting at someone's favourite hour.
      const starter = weighted(r, spec.people, (p) => p.weight);
      let hour = (starter.peak + Math.round(gauss(r) * 3.2) + 24) % 24;
      if (r() < starter.owl) hour = Math.floor(r() * 4); // after midnight
      let t = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, Math.floor(r() * 60), Math.floor(r() * 60)).getTime();
      const size = Math.min(budget, 1 + Math.floor(expo(r, isGroup ? 14 : 9)));
      budget -= size;
      let prev: Persona | null = null;
      for (let i = 0; i < size; i++) {
        const sender: Persona = prev && r() < prev.burst
          ? prev
          : weighted(r, spec.people.filter((p) => p !== prev), (p) => p.weight * (prev ? affinity(p, prev) : 1));
        t += sender === prev ? 4_000 + expo(r, 25_000) : 6_000 + expo(r, sender.replySec * 1000);
        out.push(message(r, spec, sender, t, prev !== null && prev !== sender, slugDir));
        prev = sender;
      }
    }
    // Calls, mostly in one-to-ones.
    if (spec.calls && r() < spec.calls * spec.phase(d / days, date)) {
      const caller = pick(r, spec.people);
      const missed = r() < 0.25;
      const t = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 19 + Math.floor(r() * 4), Math.floor(r() * 60)).getTime();
      const other = spec.people.find((p) => p !== caller)!;
      add({
        sender_name: caller.name, timestamp_ms: t, call_duration: missed ? 0 : Math.round(60 + expo(r, 900)), missed,
        content: isGroup ? 'The video call ended.' : missed ? `You missed a call from ${caller === ALEX ? other.name : caller.name}.` : `${caller.name} called you.`,
      });
    }
  }
  // A few unsent messages and late joins keep the edge cases honest.
  for (let i = 0; i < Math.max(1, out.length / 4000); i++) {
    const m = out[Math.floor(r() * out.length)];
    if (m.content && !m.call_duration) out.push({ sender_name: m.sender_name, timestamp_ms: m.timestamp_ms + 1500, is_unsent: true });
  }
  addReactions(r, spec, out);
  return out;
}

function message(r: Rand, spec: Spec, p: Persona, t: number, replying: boolean, dir: string): RawMessage {
  const m: RawMessage = { sender_name: p.name, timestamp_ms: Math.round(t) };
  const u = r();
  const media = (folder: string, ext: string, key: 'photos' | 'videos' | 'gifs' | 'audio_files' | 'files', n = 1) => {
    m[key] = Array.from({ length: n }, () => ({ uri: `${dir}/${folder}/${uid()}.${ext}`, creation_timestamp: Math.round(t / 1000) }));
  };
  if (u < p.photo) {
    media('photos', 'jpg', 'photos', r() < 0.2 ? 2 + Math.floor(r() * 4) : 1);
    if (r() < 0.3) m.content = text(r, p, false);
  } else if (u < p.photo + 0.008) media('videos', 'mp4', 'videos');
  else if (u < p.photo + 0.02) media('gifs', 'gif', 'gifs');
  else if (u < p.photo + 0.03) m.sticker = { uri: `your_facebook_activity/messages/stickers_used/${uid()}.png` };
  else if (u < p.photo + 0.034) media('audio', 'aac', 'audio_files');
  else if (u < p.photo + 0.0355) media('files', 'pdf', 'files');
  else if (u < p.photo + 0.0355 + p.link) {
    const link = `${pick(r, SITES)}${uid()}`;
    m.share = { link };
    m.content = r() < 0.5 ? link : `${pick(r, ['look', 'this', 'omg', 'for the trip'])} ${link}`;
  } else {
    m.content = text(r, p, replying);
    if (spec.people.length > 2 && r() < 0.015) m.content = `@${pick(r, spec.people.filter((x) => x !== p)).name} ${m.content}`;
  }
  return m;
}

function addReactions(r: Rand, spec: Spec, msgs: RawMessage[]) {
  const others = (name: string) => spec.people.filter((p) => p.name !== name);
  const byName = new Map(spec.people.map((p) => [p.name, p]));
  for (const m of msgs) {
    if (m.is_unsent || m.call_duration !== undefined || (!m.content && !m.photos && !m.gifs && !m.videos)) continue;
    const sender = byName.get(m.sender_name)!;
    const visual = m.photos || m.gifs || m.videos ? 2.2 : 1;
    const long = m.content && m.content.length > 60 ? 1.4 : 1;
    const p = 0.085 * sender.funny * visual * long;
    if (r() > p) continue;
    const pool = others(m.sender_name);
    const n = Math.min(pool.length, 1 + (r() < 0.3 ? 1 : 0) + (r() < 0.1 ? 2 : 0));
    const used = new Set<string>();
    for (let i = 0; i < n; i++) {
      const actor = weighted(r, pool.filter((x) => !used.has(x.name)), (x) => x.generous);
      used.add(actor.name);
      (m.reactions ??= []).push({ reaction: pick(r, actor.reacts), actor: actor.name });
    }
  }
}

// --- The ten conversations ----------------------------------------------------------------

const flat = () => 1;
/** Five years of the big group: slow start, a spring 2020-style peak, a dip, a revival. */
const crewPhase = (t: number, date: Date) => {
  const y = date.getFullYear(), m = date.getMonth();
  const lockdown = y === 2020 && m >= 2 && m <= 5 ? 2.6 : 1;
  const summer = m === 6 || m === 7 ? 1.25 : 1;
  const arc = t < 0.12 ? 0.35 + t * 5 : t < 0.55 ? 1 : t < 0.75 ? 0.55 : 0.95;
  return arc * lockdown * summer;
};
const fading = (t: number) => Math.max(0.08, 1.2 - t * 1.1);
const rising = (t: number) => 0.3 + t;

export function demoSpecs(): Spec[] {
  const s = SOLO;
  return [
    { slug: 'thecrew_1000000010', folder: 'inbox', title: 'The Crew 🌍', people: CREW, start: [2019, 9, 14], years: 5, perDay: 34, phase: crewPhase, seed: 11, calls: 0.01, system: true },
    { slug: 'samrivera_1000000001', folder: 'inbox', title: 'Sam Rivera', people: [ALEX, CREW[1]], start: [2019, 3, 2], years: 5.5, perDay: 9, phase: fading, seed: 21, calls: 0.03 },
    { slug: 'leafontaine_1000000002', folder: 'inbox', title: 'Léa Fontaine', people: [ALEX, s.lea], start: [2021, 1, 10], years: 3.6, perDay: 5, phase: rising, seed: 31, calls: 0.05 },
    { slug: 'weekendtrip_1000000003', folder: 'inbox', title: 'Lisbon weekend ✈️', people: [ALEX, CREW[2], CREW[3], s.ines], start: [2022, 3, 1], years: 0.4, perDay: 22, phase: (t) => (t < 0.7 ? 0.6 + t : 0.15), seed: 41, system: true },
    { slug: 'hugovalette_1000000004', folder: 'inbox', title: 'Hugo Valette', people: [ALEX, s.hugo], start: [2020, 5, 5], years: 2, perDay: 3, phase: flat, seed: 51, calls: 0.02 },
    { slug: 'fivesidefootball_1000000005', folder: 'inbox', title: 'Thursday Five-a-side ⚽', people: [ALEX, CREW[4], s.lucas, s.ethan, s.theo, s.oscar, s.hugo, CREW[1]], start: [2021, 8, 1], years: 2.5, perDay: 4, phase: (_t, d) => (d.getMonth() === 6 || d.getMonth() === 7 ? 0.2 : 1), seed: 61, system: true },
    { slug: 'zoeleclerc_1000000006', folder: 'e2ee_cutover', title: 'Zoé Leclerc', people: [ALEX, s.zoe], start: [2018, 0, 20], years: 4, perDay: 1.2, phase: fading, seed: 71, calls: 0.01 },
    { slug: 'ninacastillo_1000000007', folder: 'archived_threads', title: 'Nina Castillo', people: [ALEX, s.nina], start: [2019, 6, 1], years: 0.3, perDay: 6, phase: flat, seed: 81 },
    { slug: 'avathompson_1000000008', folder: 'message_requests', title: 'Ava Thompson', people: [ALEX, s.ava], start: [2023, 10, 3], years: 0.02, perDay: 6, phase: flat, seed: 91 },
    { slug: 'familyflat_1000000009', folder: 'inbox', title: 'Flat 4B', people: [ALEX, CREW[5], s.lea, s.theo], start: [2022, 8, 1], years: 1.8, perDay: 6, phase: flat, seed: 101, system: true },
  ];
}

const CHUNK = 10_000;
const PARTS = 3;

/** The demo export as message_N.json files, spread over three export parts like a real download. */
export function demoFiles(): { path: string; file: File }[] {
  nextId = 1_000_000;
  const out: { path: string; file: File }[] = [];
  demoSpecs().forEach((spec, si) => {
    const msgs = generate(spec).sort((a, b) => b.timestamp_ms - a.timestamp_ms); // newest first, like Facebook
    const fix = (m: RawMessage): RawMessage => ({
      ...m,
      sender_name: mojibake(m.sender_name),
      ...(m.content && { content: mojibake(m.content) }),
      ...(m.reactions && { reactions: m.reactions.map((x) => ({ reaction: mojibake(x.reaction), actor: mojibake(x.actor) })) }),
    });
    for (let c = 0; c * CHUNK < msgs.length || c === 0; c++) {
      const raw: RawThreadFile = {
        title: mojibake(spec.title),
        thread_path: `${spec.folder}/${spec.slug}`,
        is_still_participant: true,
        participants: spec.people.map((p) => ({ name: mojibake(p.name) })),
        messages: msgs.slice(c * CHUNK, (c + 1) * CHUNK).map(fix),
      };
      const part = `demo-part-${((si + c) % PARTS) + 1}`;
      const path = `${part}/your_facebook_activity/messages/${spec.folder}/${spec.slug}/message_${c + 1}.json`;
      out.push({ path, file: new File([JSON.stringify(raw)], `message_${c + 1}.json`, { type: 'application/json' }) });
    }
  });
  return out;
}
