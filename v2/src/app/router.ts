// Hash routing: #/ (picker) or #/c/<thread_id>/<section>?from=&to=&p=&k=&who=&at=
// Filters live in the URL so a view can be bookmarked or reloaded as-is.
import { useCallback, useMemo, useSyncExternalStore } from 'react';

export const SECTIONS = ['overview', 'activity', 'people', 'relations', 'reactions', 'content', 'messages', 'sql', 'wrapped'] as const;
export type Section = (typeof SECTIONS)[number];

export const KIND_GROUPS = {
  text: ['text'],
  media: ['photo', 'video', 'gif', 'sticker', 'audio', 'file'],
  link: ['link'],
  call: ['call'],
  other: ['unsent', 'other'],
} as const;
export type KindGroup = keyof typeof KIND_GROUPS;

export interface Filters {
  /** Inclusive local dates, YYYY-MM-DD. */
  from?: string;
  to?: string;
  /** Senders to keep; empty = everyone. */
  people: string[];
  /** Content types to keep; empty = all. */
  kinds: KindGroup[];
}

export type Route =
  | { view: 'picker' }
  | { view: 'conversation'; threadId: number; section: Section; filters: Filters; who?: string; at?: number };

export const NO_FILTERS: Filters = { people: [], kinds: [] };

export function parseHash(hash: string): Route {
  const [path, qs = ''] = hash.replace(/^#/, '').split('?');
  const m = path.match(/^\/c\/(\d+)(?:\/(\w+))?/);
  if (!m) return { view: 'picker' };
  const q = new URLSearchParams(qs);
  const section = (SECTIONS as readonly string[]).includes(m[2] ?? '') ? (m[2] as Section) : 'overview';
  return {
    view: 'conversation',
    threadId: Number(m[1]),
    section,
    filters: {
      from: q.get('from') ?? undefined,
      to: q.get('to') ?? undefined,
      people: q.getAll('p'),
      kinds: q.getAll('k').filter((k): k is KindGroup => k in KIND_GROUPS),
    },
    who: q.get('who') ?? undefined,
    at: q.get('at') ? Number(q.get('at')) : undefined,
  };
}

export function toHash(r: Route): string {
  if (r.view === 'picker') return '#/';
  const q = new URLSearchParams();
  if (r.filters.from) q.set('from', r.filters.from);
  if (r.filters.to) q.set('to', r.filters.to);
  r.filters.people.forEach((p) => q.append('p', p));
  r.filters.kinds.forEach((k) => q.append('k', k));
  if (r.who) q.set('who', r.who);
  if (r.at !== undefined) q.set('at', String(r.at));
  const s = q.toString();
  return `#/c/${r.threadId}/${r.section}${s ? `?${s}` : ''}`;
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export function useRoute(): [Route, (r: Route) => void] {
  const hash = useSyncExternalStore(subscribe, () => location.hash);
  const route = useMemo(() => parseHash(hash), [hash]);
  const navigate = useCallback((r: Route) => {
    location.hash = toHash(r);
  }, []);
  return [route, navigate];
}
