// Wrapped: a personal story for anyone in the conversation, or (in groups)
// a group story where every member gets a title.
import { Play, User, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useConversation } from '../app/ConversationProvider';
import { DARK_PEOPLE } from '../charts/theme';
import { lit } from '../db/duckdb';
import { useQuery } from '../db/useQuery';
import { fmtInt } from '../lib/format';
import { hourLabel } from '../lib/time';
import { Badge } from '../ui/Badge';
import { Panel, Segmented, Stat } from '../ui/primitives';
import { chronotype, loadGroupWrapped, loadWrapped, type GroupWrapped, type WrappedData } from './wrapped/data';
import { buildGroupSlides, buildPersonSlides } from './wrapped/slides';
import { StoryPlayer } from './wrapped/StoryPlayer';
import './wrapped/wrapped.css';

const BRAND = '#ff5f1a';
// Loads share temp views, so run one at a time.
let queue: Promise<unknown> = Promise.resolve();

type Mode = 'person' | 'group';

function YearChips({ years, value, onChange }: { years: { y: number; n: number }[]; value: number | null; onChange: (y: number | null) => void }) {
  const chip = (active: boolean) => `h-8 rounded-md border px-3 ${active ? 'border-accent bg-accent-soft font-medium' : 'border-line bg-surface hover:bg-surface-2'}`;
  return (
    <div className="flex flex-wrap gap-1.5">
      {years.map((y) => (
        <button key={y.y} onClick={() => onChange(y.y)} className={chip(value === y.y)}>
          {y.y} <span className="num ml-1 text-[11px] text-ink-3">{fmtInt(y.n)}</span>
        </button>
      ))}
      <button onClick={() => onChange(null)} className={chip(value === null)}>All time</button>
    </div>
  );
}

function TitlesTable({ g }: { g: GroupWrapped }) {
  return (
    <Panel title={`Everyone’s title · ${g.titles.length} people`} actions={<span className="text-[11px] text-ink-3">each member’s strongest trait relative to the group (20+ messages)</span>}>
      <div className="grid grid-cols-1 gap-px bg-line @3xl:grid-cols-2 @6xl:grid-cols-3">
        {g.titles.map((w) => (
          <div key={w.name} className="flex items-center gap-3 bg-surface px-3 py-2">
            <Badge name={w.name} size={26} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{w.name}</div>
              <div className="truncate text-[11px] text-ink-3">{w.award.emoji} {w.award.title} · {w.award.format(w.value)} {w.award.unit}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AwardsTable({ g }: { g: GroupWrapped }) {
  return (
    <Panel title="Awards" actions={<span className="text-[11px] text-ink-3">the leader of each category</span>}>
      <div className="grid grid-cols-1 gap-px bg-line @3xl:grid-cols-2 @6xl:grid-cols-3">
        {g.winners.map((w) => (
          <div key={w.award.id} className="flex items-center gap-3 bg-surface px-3 py-2">
            <span className="w-7 text-center text-[20px]">{w.award.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{w.award.title}</div>
              <div className="text-[11px] text-ink-3">{w.award.format(w.value)} {w.award.unit}</div>
            </div>
            <Badge name={w.name} size={22} />
            <span className="w-28 truncate">{w.name}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function Wrapped() {
  const { conv, epoch } = useConversation();
  const active = conv.people.filter((p) => p.messages > 0);
  const [mode, setMode] = useState<Mode>('person');
  const [person, setPerson] = useState(active.find((p) => p.isMe)?.name ?? active[0]?.name ?? '');
  const who = mode === 'person' ? person : null;
  const years = useQuery<{ y: number; n: number }>(`SELECT year(ts) AS y, count(*) AS n FROM conv ${who ? `WHERE sender = ${lit(who)}` : ''} GROUP BY 1 ORDER BY 1 DESC`).data ?? [];
  const [year, setYear] = useState<number | null | undefined>(undefined);
  // Default to the latest year once the years are known.
  const effectiveYear = year === undefined ? years[0]?.y ?? null : year;
  const [data, setData] = useState<WrappedData | GroupWrapped | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    if (epoch === 0 || (mode === 'person' && !person) || (year === undefined && !years.length)) return;
    const mine = ++seq.current;
    setLoading(true);
    const p = queue.then((): Promise<WrappedData | GroupWrapped> => (mode === 'group' ? loadGroupWrapped(conv, effectiveYear) : loadWrapped(conv, person, effectiveYear)));
    queue = p.catch(() => undefined);
    p.then((d) => mine === seq.current && setData(d))
      .catch((e: unknown) => console.error('Wrapped failed', e))
      .finally(() => mine === seq.current && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, person, effectiveYear, epoch, conv]);

  const actions = { onReplay: () => setPlaying((n) => n + 1), onClose: () => setPlaying(0) };
  const slides = useMemo(
    () => (!data ? [] : data.mode === 'group' ? buildGroupSlides(data, actions) : buildPersonSlides(data, actions)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );
  const slot = conv.people.find((p) => p.name === person)?.slot ?? 0;
  const accent = mode === 'group' ? BRAND : DARK_PEOPLE[slot % DARK_PEOPLE.length];
  const periodLabel = effectiveYear ?? 'all-time';
  const pd = data?.mode === 'person' ? data : null;
  const gd = data?.mode === 'group' ? data : null;
  const empty = pd ? !pd.mine : gd ? !gd.total : true;

  return (
    <div className="flex h-full">
      {mode === 'person' && (
        <div className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
          <div className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-ink-3">Whose Wrapped</div>
          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {active.map((p) => (
              <button
                key={p.name}
                onClick={() => (setPerson(p.name), setYear(undefined))}
                className={`flex h-8 w-full items-center gap-2 px-3 text-left ${p.name === person ? 'bg-accent-soft font-medium' : 'hover:bg-surface-2'}`}
              >
                <Badge name={p.name} size={18} />
                <span className="min-w-0 flex-1 truncate">{p.name}{p.isMe && <span className="text-ink-3"> (you)</span>}</span>
                <span className="num text-[11px] text-ink-3">{fmtInt(p.messages)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="@container min-w-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl space-y-5 p-6">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-[18px] font-semibold">
                {mode === 'group' ? `${conv.title} · ${periodLabel} Group Wrapped` : `${person}’s ${periodLabel} Wrapped`}
              </h2>
              <p className="mt-1 text-ink-3">
                {mode === 'group' ? 'The group’s story: podium, duo, awards, and a title for every member.' : `Their story in ${conv.title}, in their own colour.`} It ignores the filter bar.
              </p>
            </div>
            {conv.isGroup && (
              <Segmented
                value={mode}
                options={[['person', 'Person'], ['group', 'Group']] as [Mode, string][]}
                onChange={(m) => (setMode(m), setYear(undefined), setData(null))}
              />
            )}
          </div>

          <YearChips years={years} value={effectiveYear} onChange={setYear} />

          <div className={`grid grid-cols-2 gap-3 @3xl:grid-cols-4 transition-opacity ${loading ? 'opacity-50' : ''}`}>
            {pd ? (
              <>
                <Stat label="Messages" value={fmtInt(pd.mine)} sub={pd.total ? `${((pd.mine / pd.total) * 100).toFixed(1)}% of the conversation` : undefined} />
                <Stat label={conv.isGroup ? 'Title' : 'Reactions'} value={conv.isGroup ? pd.title ? `${pd.title.award.emoji} ${pd.title.award.title.replace('The ', '')}` : '–' : fmtInt(pd.received)} />
                <Stat label="Peak hour" value={pd.mine ? hourLabel(pd.hourly.indexOf(Math.max(...pd.hourly))) : '–'} sub={pd.mine ? chronotype(pd.hourly).name : undefined} />
                <Stat label="Closest to" value={pd.orbit[0]?.name.split(' ')[0] ?? '–'} sub={pd.topFan ? `top fan: ${pd.topFan.name.split(' ')[0]}` : undefined} />
              </>
            ) : gd ? (
              <>
                <Stat label="Messages" value={fmtInt(gd.total)} sub={`${gd.senders} people`} />
                <Stat label="Loudest" value={gd.podium[0]?.name.split(' ')[0] ?? '–'} sub={gd.podium[0] ? `${fmtInt(gd.podium[0].n)} messages` : undefined} />
                <Stat label="Duo" value={gd.duo ? `${gd.duo.a.split(' ')[0]} & ${gd.duo.b.split(' ')[0]}` : '–'} sub={gd.duo ? `${fmtInt(gd.duo.n)} replies` : undefined} />
                <Stat label="Active days" value={fmtInt(gd.activeDays)} />
              </>
            ) : (
              <div className="col-span-4 h-[62px]" />
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              disabled={!data || loading || empty}
              onClick={() => setPlaying((n) => n + 1)}
              style={{ background: accent }}
              className="inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-6 text-[15px] font-semibold text-black shadow-lg hover:brightness-110 disabled:opacity-40"
            >
              <Play size={16} fill="currentColor" /> Play {mode === 'group' ? 'Group Wrapped' : 'Wrapped'}
              {data && <span className="text-[12px] font-normal opacity-70">{slides.length} slides</span>}
            </button>
            <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
              {mode === 'group' ? <Users size={13} /> : <User size={13} />}
              → / click right: next · ← / click left: back · hold or space: pause · esc: close
            </span>
          </div>
          {data && empty && !loading && <p className="text-ink-3">Nothing was sent in {periodLabel}.</p>}

          {gd && gd.winners.length > 0 && <AwardsTable g={gd} />}
          {gd && gd.titles.length > 0 && <TitlesTable g={gd} />}
        </div>
      </div>

      {playing > 0 && data && <StoryPlayer key={playing} slides={slides} accent={accent} onClose={() => setPlaying(0)} />}
    </div>
  );
}
