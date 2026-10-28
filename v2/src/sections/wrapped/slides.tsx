// The Wrapped stories, slide by slide. Slides without data are left out.
import { toPng } from 'html-to-image';
import { Download } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { fmtInt } from '../../lib/format';
import { hourLabel } from '../../lib/time';
import { Badge } from '../../ui/Badge';
import { chronotype, type GroupWrapped, type WrappedData } from './data';
import type { Slide } from './StoryPlayer';
import { Clock, Orbit, Podium, ShareRing, Squares } from './visuals';

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const first = (name: string) => name.split(' ')[0];
const rest = (name: string) => name.split(' ').slice(1).join(' ');
const argmax = (a: number[]) => a.reduce((best, v, i) => (v > a[best] ? i : best), 0);

function Counter({ value, ms = 1400 }: { value: number; ms?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setV(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <>{fmtInt(v)}</>;
}

/** Label on top, content centred, an optional line of context at the bottom. */
function Frame({ label, children, footer }: { label: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className="wr-label wr-fade">{label}</div>
      <div className="flex flex-1 flex-col justify-center">{children}</div>
      {footer && <div className="wr-up wr-d4 text-[15px] leading-snug text-[var(--wr-text-2)]">{footer}</div>}
    </div>
  );
}

function Big({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`wr-hero wr-scale wr-d1 break-words ${className}`}>{children}</div>;
}

function Quote({ text, kind }: { text: string | null; kind: string }) {
  if (!text) {
    return (
      <div className="wr-scale wr-d1">
        <div className="wr-big">A {kind === 'gif' ? 'GIF' : kind}</div>
        <div className="mt-2 text-[15px] text-[var(--wr-text-2)]">Media isn’t in the analysis, but everyone loved it.</div>
      </div>
    );
  }
  return <div className="wr-scale wr-d1 text-[clamp(22px,3vh,32px)] font-medium leading-snug">“{text.slice(0, 220)}{text.length > 220 ? '…' : ''}”</div>;
}

function SquaresSlide({ label, days, year, footer }: { label: string; days: { d: number; n: number }[]; year: number | null; footer: ReactNode }) {
  return (
    <Frame label={label} footer={footer}>
      <Squares days={days} year={year} />
    </Frame>
  );
}

type Actions = { onReplay: () => void; onClose: () => void };

// --- Personal story -------------------------------------------------------------------

export function buildPersonSlides(d: WrappedData, a: Actions): Slide[] {
  const period = d.year ? String(d.year) : 'All-time';
  const share = d.total ? d.mine / d.total : 0;
  const activeDays = d.year ? d.days.length : null;
  const slides: (Slide | false | null)[] = [
    {
      id: 'title',
      seconds: 4,
      render: () => (
        <div className="flex h-full flex-col justify-center">
          <div className="wr-label wr-fade">{period} Wrapped</div>
          <div className="wr-scale wr-d1 mt-6"><Badge name={d.person} size={72} /></div>
          <div className="wr-hero wr-up wr-d2 mt-5 break-words">{first(d.person)}</div>
          <div className="wr-up wr-d2 mt-1 text-[22px] text-[var(--wr-text-2)]">{rest(d.person)}</div>
          <div className="wr-up wr-d3 mt-10 text-[15px] text-[var(--wr-text-2)]">in <span className="text-[var(--wr-text)]">{d.conversation}</span></div>
        </div>
      ),
    },
    {
      id: 'messages',
      seconds: 6,
      render: () => (
        <Frame label="You sent" footer={<>{fmtInt(d.words)} words{d.isGroup ? `, ${d.rank === 1 ? 'more than anyone' : `#${d.rank} of ${d.senders} people`}` : ''}.</>}>
          <Big><Counter value={d.mine} /></Big>
          <div className="wr-label wr-up wr-d2 mb-8 mt-3">messages</div>
          <div className="wr-up wr-d3"><ShareRing share={share} label="of the conversation" /></div>
        </Frame>
      ),
    },
    !d.isGroup && d.other && {
      id: 'versus',
      seconds: 6,
      render: () => {
        const tot = Math.max(1, d.mine + d.other!.n);
        return (
          <Frame label={`You vs ${first(d.other!.name)}`} footer={d.mine > d.other!.n ? 'You carried the conversation.' : d.mine < d.other!.n ? `${first(d.other!.name)} talked a little more.` : 'Perfectly balanced.'}>
            {[{ name: d.person, label: 'You', n: d.mine }, { name: d.other!.name, label: first(d.other!.name), n: d.other!.n }].map((r, i) => (
              <div key={r.name} className={`wr-up mt-7 ${i ? 'wr-d2' : 'wr-d1'}`}>
                <div className="flex items-center gap-3">
                  <Badge name={r.name} size={30} />
                  <span className="flex-1 text-[22px] font-semibold">{r.label}</span>
                  <span className="wr-big">{Math.round((r.n / tot) * 100)}%</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[var(--wr-accent)]" style={{ width: `${(r.n / tot) * 100}%`, opacity: i ? 0.55 : 1 }} />
                </div>
              </div>
            ))}
          </Frame>
        );
      },
    },
    d.days.length > 1 && {
      id: 'squares',
      seconds: 7,
      render: () => (
        <SquaresSlide
          label={d.year ? `Your ${d.year}, day by day` : 'Your years, month by month'}
          days={d.days}
          year={d.year}
          footer={activeDays !== null
            ? <>You showed up on <span className="wr-accent">{activeDays}</span> days. Busiest month: {MONTHS_LONG[argmax(d.monthly)]}.</>
            : <>{d.days.length} active months.</>}
        />
      ),
    },
    d.busiestDay && {
      id: 'day',
      seconds: 5,
      render: () => (
        <Frame label="Your biggest day" footer={<>{fmtInt(d.busiestDay!.n)} messages in a single day.</>}>
          <div className="wr-big wr-scale wr-d1">{longDate.format(new Date(d.busiestDay!.day)).replace(',', '')}</div>
        </Frame>
      ),
    },
    d.mine > 0 && {
      id: 'clock',
      seconds: 7,
      render: () => {
        const c = chronotype(d.hourly);
        return (
          <Frame label="Your clock" footer={<>Peak at <span className="wr-accent">{hourLabel(argmax(d.hourly))}</span>. {c.line}.</>}>
            <Clock hourly={d.hourly} />
            <div className="wr-big wr-up wr-d3 mt-6 text-center">{c.name}</div>
          </Frame>
        );
      },
    },
    d.title && {
      id: 'title-award',
      seconds: 6,
      render: () => (
        <Frame label="The group calls you" footer={d.won.length > 1 ? `You also lead: ${d.won.filter((w) => w.award.id !== d.title!.award.id).map((w) => w.award.title.replace('The ', '')).join(', ')}.` : 'Every member gets one. This one is yours.'}>
          <div className="wr-scale wr-d1 text-[96px] leading-none">{d.title!.award.emoji}</div>
          <div className="wr-hero wr-up wr-d2 mt-5 text-[clamp(44px,6.5vh,76px)]">{d.title!.award.title}</div>
          <div className="wr-up wr-d3 mt-3 text-[18px] text-[var(--wr-text-2)]">{d.title!.award.format(d.title!.value)} {d.title!.award.unit}</div>
        </Frame>
      ),
    },
    d.orbit.length > 0 && {
      id: 'orbit',
      seconds: 7,
      render: () => (
        <Frame label="Your people" footer="The closer, the more you replied to and reacted to each other.">
          <Orbit center={d.person} people={d.orbit} />
        </Frame>
      ),
    },
    d.received > 0 && {
      id: 'received',
      seconds: 6,
      render: () => (
        <Frame
          label="People loved your messages"
          footer={<>{d.receivedRate.toFixed(1)} per 100 messages (conversation average {d.convRate.toFixed(1)}).{d.topFan ? <> Biggest fan: <span className="wr-accent">{first(d.topFan.name)}</span>, {fmtInt(d.topFan.n)} reactions.</> : null}</>}
        >
          <Big><Counter value={d.received} /></Big>
          <div className="wr-label wr-up wr-d2 mt-3">reactions received</div>
          {d.topFan && <div className="wr-up wr-d3 mt-8 flex items-center gap-3"><Badge name={d.topFan.name} size={44} /><span className="text-[24px] font-semibold">{d.topFan.name}</span></div>}
        </Frame>
      ),
    },
    d.emojisGiven.length > 0 && {
      id: 'emoji',
      seconds: 6,
      render: () => (
        <Frame label="Your reaction style" footer={<>{fmtInt(d.given)} reactions given{d.favourite ? <>, most of them to <span className="wr-accent">{first(d.favourite.name)}</span></> : null}.</>}>
          <div className="space-y-3">
            {d.emojisGiven.map((e, i) => (
              <div key={e.e} className="wr-up flex items-center gap-5" style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
                <span className={i === 0 ? 'text-[72px] leading-none' : 'text-[40px] leading-none'}>{e.e}</span>
                <span className="wr-big text-[var(--wr-text-2)]">{fmtInt(e.n)}</span>
              </div>
            ))}
          </div>
        </Frame>
      ),
    },
    d.bestMessage && d.bestMessage.n > 1 && {
      id: 'best',
      seconds: 7,
      render: () => (
        <Frame label="Your most loved message" footer={<>{shortDate.format(new Date(d.bestMessage!.ts))} · {fmtInt(d.bestMessage!.n)} reactions</>}>
          <Quote text={d.bestMessage!.text} kind={d.bestMessage!.kind} />
          <div className="wr-up wr-d3 mt-6 text-[34px] leading-none">{[...new Set(d.bestMessage!.emojis)].slice(0, 8).join(' ')}</div>
        </Frame>
      ),
    },
    d.topWords.length > 0 && {
      id: 'words',
      seconds: 6,
      render: () => (
        <Frame label="Your words" footer="Most used, leaving out the little ones.">
          <div className="space-y-2">
            {d.topWords.map((w, i) => (
              <div key={w.w} className="wr-up flex items-baseline justify-between gap-4" style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
                <span className={`${i === 0 ? 'wr-hero wr-accent' : 'wr-big'} truncate`}>{w.w}</span>
                <span className="wr-label shrink-0">{fmtInt(w.n)}×</span>
              </div>
            ))}
          </div>
        </Frame>
      ),
    },
    (d.sessionsStarted > 0 || (d.streak && d.streak.days > 1)) && {
      id: 'habits',
      seconds: 6,
      render: () => (
        <Frame label="Your habits">
          <div className="grid gap-10">
            {d.streak && d.streak.days > 1 && (
              <div className="wr-up wr-d1">
                <div className="wr-hero"><Counter value={d.streak.days} ms={900} /></div>
                <div className="wr-label mt-2">days in a row · {shortDate.format(new Date(d.streak.from))} → {shortDate.format(new Date(d.streak.to))}</div>
              </div>
            )}
            {d.sessionsStarted > 0 && (
              <div className="wr-up wr-d3">
                <div className="wr-hero"><Counter value={d.sessionsStarted} /></div>
                <div className="wr-label mt-2">times you broke a 2-hour silence{d.starterRank === 1 ? ' · the most' : ` · #${d.starterRank} of ${d.starters}`}</div>
              </div>
            )}
          </div>
        </Frame>
      ),
    },
    {
      id: 'media',
      seconds: 6,
      render: () => (
        <Frame label="You shared">
          <div className="grid grid-cols-2 gap-x-6 gap-y-8">
            {([['photo', 'Photos'], ['video', 'Videos'], ['gif', 'GIFs'], ['audio', 'Voice notes'], ['link', 'Links'], ['call', 'Calls']] as const).map(([k, label], i) => (
              <div key={k} className="wr-up" style={{ animationDelay: `${0.15 + i * 0.1}s` }}>
                <div className="wr-big">{fmtInt(d.media[k])}</div>
                <div className="wr-label mt-1">{label}</div>
              </div>
            ))}
          </div>
        </Frame>
      ),
    },
    {
      id: 'card',
      seconds: 0,
      render: () => (
        <CardSlide
          {...a}
          file={`${d.person} ${period} Wrapped`}
          heading={<><Badge name={d.person} size={26} /> {d.person}</>}
          period={period}
          conversation={d.conversation}
          stats={[
            ['Messages', fmtInt(d.mine)],
            [d.isGroup ? 'Rank' : 'Share', d.isGroup ? `#${d.rank}` : `${Math.round(share * 100)}%`],
            ['Reactions', fmtInt(d.received)],
            ['Streak', d.streak ? `${d.streak.days} d` : '–'],
            ['Peak hour', hourLabel(argmax(d.hourly))],
            ['Top fan', d.topFan ? first(d.topFan.name) : '–'],
            ['Style', d.emojisGiven[0]?.e ?? '–'],
            [d.title ? 'Title' : 'Type', d.title ? d.title.award.title.replace('The ', '') : chronotype(d.hourly).name],
          ]}
        />
      ),
    },
  ];
  return slides.filter((s): s is Slide => !!s);
}

// --- Group story ----------------------------------------------------------------------

export function buildGroupSlides(g: GroupWrapped, a: Actions): Slide[] {
  const period = g.year ? String(g.year) : 'All-time';
  const PAGE = 8;
  const titlePages = Array.from({ length: Math.ceil(g.titles.length / PAGE) }, (_, i) => g.titles.slice(i * PAGE, i * PAGE + PAGE));
  const slides: (Slide | false | null)[] = [
    {
      id: 'title',
      seconds: 4,
      render: () => (
        <div className="flex h-full flex-col justify-center">
          <div className="wr-label wr-fade">{period} Group Wrapped</div>
          <div className={`wr-hero wr-up wr-d1 mt-5 ${g.conversation.length > 16 ? 'text-[clamp(34px,4.6vh,54px)]' : 'text-[clamp(48px,7vh,88px)]'}`} style={{ overflowWrap: 'anywhere' }}>{g.conversation}</div>
          <div className="wr-up wr-d3 mt-8 flex flex-wrap gap-1.5">
            {g.metrics.slice(0, 24).map((m) => <Badge key={m.name} name={m.name} size={26} />)}
            {g.metrics.length > 24 && <span className="wr-label self-center">+{g.metrics.length - 24}</span>}
          </div>
        </div>
      ),
    },
    {
      id: 'total',
      seconds: 6,
      render: () => (
        <Frame label="Together you sent" footer={<>{fmtInt(g.words)} words from {g.senders} people, across {g.activeDays} days.</>}>
          <Big><Counter value={g.total} /></Big>
          <div className="wr-label wr-up wr-d2 mt-3">messages</div>
        </Frame>
      ),
    },
    g.podium.length > 1 && {
      id: 'podium',
      seconds: 7,
      render: () => (
        <Frame label="The loudest voices" footer={<><span className="wr-accent">{first(g.podium[0].name)}</span> wrote {fmtInt(g.podium[0].n)} messages.</>}>
          <Podium top={g.podium} total={g.total} />
        </Frame>
      ),
    },
    g.days.length > 1 && {
      id: 'squares',
      seconds: 7,
      render: () => (
        <SquaresSlide
          label={g.year ? `The group’s ${g.year}, day by day` : 'The group’s years, month by month'}
          days={g.days}
          year={g.year}
          footer={<>Busiest month: <span className="wr-accent">{MONTHS_LONG[argmax(g.monthly)]}</span>. Peak hour: {hourLabel(argmax(g.hourly))}.</>}
        />
      ),
    },
    g.busiestDay && {
      id: 'day',
      seconds: 5,
      render: () => (
        <Frame label="The biggest day" footer={<>{fmtInt(g.busiestDay!.n)} messages, led by {first(g.busiestDay!.top)}.</>}>
          <div className="wr-big wr-scale wr-d1">{longDate.format(new Date(g.busiestDay!.day)).replace(',', '')}</div>
        </Frame>
      ),
    },
    g.duo && {
      id: 'duo',
      seconds: 6,
      render: () => (
        <Frame label="The duo of the year" footer={<>{fmtInt(g.duo!.n)} replies back and forth.</>}>
          <div className="wr-scale wr-d1 flex items-center gap-4">
            <Badge name={g.duo!.a} size={64} />
            <span className="wr-big wr-accent">↔</span>
            <Badge name={g.duo!.b} size={64} />
          </div>
          <div className="wr-big wr-up wr-d2 mt-6">{first(g.duo!.a)} &amp; {first(g.duo!.b)}</div>
        </Frame>
      ),
    },
    g.bestMessage && g.bestMessage.n > 1 && {
      id: 'best',
      seconds: 7,
      render: () => (
        <Frame label="The message of the year" footer={<>{first(g.bestMessage!.sender)} · {shortDate.format(new Date(g.bestMessage!.ts))} · {fmtInt(g.bestMessage!.n)} reactions</>}>
          <div className="wr-fade mb-5"><Badge name={g.bestMessage!.sender} size={40} /></div>
          <Quote text={g.bestMessage!.text} kind={g.bestMessage!.kind} />
          <div className="wr-up wr-d3 mt-6 text-[34px] leading-none">{[...new Set(g.bestMessage!.emojis)].slice(0, 8).join(' ')}</div>
        </Frame>
      ),
    },
    g.winners.length > 0 && {
      id: 'awards',
      seconds: 9,
      render: () => (
        <Frame label="The awards">
          <div className="space-y-3.5">
            {g.winners.slice(0, 8).map((w, i) => (
              <div key={w.award.id} className="wr-up flex items-center gap-3" style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
                <span className="w-9 text-center text-[26px] leading-none">{w.award.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold leading-tight">{w.award.title}</div>
                  <div className="text-[12px] text-[var(--wr-text-2)]">{w.award.format(w.value)} {w.award.unit}</div>
                </div>
                <Badge name={w.name} size={28} />
                <span className="w-20 truncate text-[13px] font-medium">{first(w.name)}</span>
              </div>
            ))}
          </div>
        </Frame>
      ),
    },
    ...titlePages.map((page, p) => ({
      id: `titles-${p}`,
      seconds: 8,
      render: () => (
        <Frame label={`Everyone’s title${titlePages.length > 1 ? ` · ${p + 1}/${titlePages.length}` : ''}`}>
          <div className="space-y-3">
            {page.map((w, i) => (
              <div key={w.name} className="wr-up flex items-center gap-3" style={{ animationDelay: `${0.1 + i * 0.09}s` }}>
                <Badge name={w.name} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">{w.name}</div>
                  <div className="truncate text-[12px] text-[var(--wr-text-2)]">{w.award.emoji} {w.award.title} · {w.award.format(w.value)} {w.award.unit}</div>
                </div>
              </div>
            ))}
          </div>
        </Frame>
      ),
    })),
    g.topReactions.length > 0 && {
      id: 'vibe',
      seconds: 6,
      render: () => (
        <Frame label="The group’s vibe" footer={g.topWords.length ? <>Most said: {g.topWords.slice(0, 3).map((w) => `“${w.w}”`).join(', ')}.</> : undefined}>
          <div className="wr-scale wr-d1 flex flex-wrap items-end gap-4">
            {g.topReactions.map((e, i) => <span key={e.e} style={{ fontSize: 76 - i * 10 }} className="leading-none">{e.e}</span>)}
          </div>
        </Frame>
      ),
    },
    {
      id: 'card',
      seconds: 0,
      render: () => (
        <CardSlide
          {...a}
          file={`${g.conversation} ${period} Group Wrapped`}
          heading={<>{g.conversation}</>}
          period={`${period} Group`}
          conversation={`${g.senders} people`}
          stats={[
            ['Messages', fmtInt(g.total)],
            ['Active days', fmtInt(g.activeDays)],
            ['Loudest', g.podium[0] ? first(g.podium[0].name) : '–'],
            ['Duo', g.duo ? `${first(g.duo.a)} & ${first(g.duo.b)}` : '–'],
            ['Peak hour', hourLabel(argmax(g.hourly))],
            ['Vibe', g.topReactions[0]?.e ?? '–'],
          ]}
        />
      ),
    },
  ];
  return slides.filter((s): s is Slide => !!s);
}

// --- Share card ---------------------------------------------------------------------------

function CardSlide({ heading, period, conversation, stats, file, onReplay, onClose }: Actions & {
  heading: ReactNode; period: string; conversation: string; stats: [string, string][]; file: string;
}) {
  const card = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!card.current) return;
    setSaving(true);
    try {
      const url = await toPng(card.current, { pixelRatio: 3, backgroundColor: '#050505' });
      const link = document.createElement('a');
      link.href = url;
      link.download = `${file.replace(/[^\p{L}\p{N} _-]/gu, '').trim()}.png`;
      link.click();
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex h-full flex-col justify-center">
      <div ref={card} className="wr wr-scale rounded-xl border border-[var(--wr-line)] bg-[var(--wr-surface)] p-6">
        <div className="wr-label">{period} Wrapped</div>
        <div className="mt-2 flex items-center gap-2 text-[24px] font-bold leading-tight">{heading}</div>
        <div className="mt-1 truncate text-[13px] text-[var(--wr-text-2)]">{conversation}</div>
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5">
          {stats.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <div className={`font-bold leading-none ${value.length > 9 ? 'text-[18px] leading-tight' : 'truncate text-[26px]'}`}>{value}</div>
              <div className="wr-label mt-1.5 text-[9px]">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 h-1 rounded-full bg-[var(--wr-accent)]" />
        <div className="wr-label mt-3 text-center text-[9px] text-[var(--wr-muted)]">MSGS // your year in data</div>
      </div>
      <div className="wr-up wr-d3 mt-6 flex justify-center gap-2">
        <button onClick={onReplay} className="rounded-full bg-[var(--wr-accent)] px-4 py-2 text-[13px] font-semibold text-black hover:brightness-110">Watch again</button>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wr-line)] px-4 py-2 text-[13px] text-[var(--wr-text)] hover:bg-white/5 disabled:opacity-50">
          <Download size={14} /> {saving ? 'Saving…' : 'Save image'}
        </button>
        <button onClick={onClose} className="rounded-full px-3 py-2 text-[13px] text-[var(--wr-text-2)] hover:text-white">Close</button>
      </div>
    </div>
  );
}
