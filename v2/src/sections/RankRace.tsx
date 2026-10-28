// Full-screen race: everyone's rank, month by month. Values glide between
// months and rows slide to their new rank, so leads change hands visibly.
import { Pause, Play, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useConversation } from '../app/ConversationProvider';
import { useQuery } from '../db/useQuery';
import { fmtInt } from '../lib/format';
import { Badge } from '../ui/Badge';

type Mode = 'rolling' | 'total' | 'month';
const MODES: [Mode, string, string][] = [
  ['rolling', 'Last 12 months', 'messages in the 12 months to'],
  ['total', 'All time', 'messages since the start, up to'],
  ['month', 'That month', 'messages in'],
];
const SPEEDS = [0.5, 1, 2, 4];
const MONTHS_PER_SECOND = 2.5;
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' });

function monthsBetween(a: number, b: number): number[] {
  const out: number[] = [];
  const d = new Date(a);
  while (d.getTime() <= b) {
    out.push(d.getTime());
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

export function RankRace({ onClose }: { onClose: () => void }) {
  const { seriesNames } = useConversation();
  const q = useQuery<{ s: string; m: number; n: number }>(
    `SELECT sender AS s, epoch_ms(date_trunc('month', ts)) AS m, count(*) AS n FROM sel GROUP BY 1, 2`,
  );
  const [mode, setMode] = useState<Mode>('rolling');
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [pos, setPos] = useState(0);
  const posRef = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const [boardH, setBoardH] = useState(600);

  // Months × people, then the measure for the chosen mode.
  const data = useMemo(() => {
    const rows = q.data ?? [];
    if (!rows.length) return null;
    const months = monthsBetween(Math.min(...rows.map((r) => r.m)), Math.max(...rows.map((r) => r.m)));
    const index = new Map(months.map((m, i) => [m, i]));
    const raw = new Map<string, number[]>(seriesNames.map((n) => [n, new Array(months.length).fill(0)]));
    for (const r of rows) raw.get(r.s)?.splice(index.get(r.m)!, 1, r.n);
    const totals = months.map((_, i) => [...raw.values()].reduce((s, v) => s + v[i], 0));
    return { months, raw, totals };
  }, [q.data, seriesNames]);

  const values = useMemo(() => {
    if (!data) return new Map<string, number[]>();
    const out = new Map<string, number[]>();
    for (const [name, v] of data.raw) {
      if (mode === 'month') out.set(name, v);
      else {
        const acc: number[] = [];
        let run = 0;
        v.forEach((x, i) => {
          run += x - (mode === 'rolling' && i >= 12 ? v[i - 12] : 0);
          acc.push(run);
        });
        out.set(name, acc);
      }
    }
    return out;
  }, [data, mode]);

  // Who led each month, and for how long in a row by then.
  const leaders = useMemo(() => {
    if (!data) return [];
    let prev: string | null = null, run = 0;
    return data.months.map((_, i) => {
      let best: string | null = null, bv = 0;
      for (const [n, v] of values) if (v[i] > bv) (best = n), (bv = v[i]);
      run = best && best === prev ? run + 1 : 1;
      prev = best;
      return { name: best, run };
    });
  }, [data, values]);

  const last = data ? data.months.length - 1 : 0;

  // Animation clock: advance the playhead in months per second.
  useEffect(() => {
    if (!playing || !data) return;
    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      const next = Math.min(last, posRef.current + ((now - prev) / 1000) * MONTHS_PER_SECOND * speed);
      prev = now;
      posRef.current = next;
      setPos(next);
      if (next >= last) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, data, last]);

  const seek = (p: number) => {
    posRef.current = Math.max(0, Math.min(last, p));
    setPos(posRef.current);
  };
  const toggle = () => {
    if (!playing && posRef.current >= last) seek(0);
    setPlaying((p) => !p);
  };

  // Full screen while open; leaving full screen (Esc) closes the race.
  useEffect(() => {
    const el = root.current!;
    let entered = false;
    const onChange = () => {
      if (document.fullscreenElement === el) entered = true;
      else if (entered) onClose();
    };
    document.addEventListener('fullscreenchange', onChange);
    el.requestFullscreen?.().catch(() => {});
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [onClose]);

  // Own the keyboard while open so section shortcuts don't fire underneath.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') onClose();
      else if (e.key === ' ') (e.preventDefault(), toggle());
      else if (e.key === 'ArrowRight') (setPlaying(false), seek(Math.floor(posRef.current) + 1));
      else if (e.key === 'ArrowLeft') (setPlaying(false), seek(Math.ceil(posRef.current) - 1));
      else if (e.key === 'Home') seek(0);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  useEffect(() => {
    const el = board.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoardH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  // Values at the playhead, interpolated between the two nearest months.
  const i0 = Math.floor(pos), f = pos - i0, i1 = Math.min(last, i0 + 1);
  const frame = seriesNames
    .map((name, order) => {
      const v = values.get(name);
      return { name, order, v: v ? v[i0] + (v[i1] - v[i0]) * f : 0 };
    })
    .sort((a, b) => b.v - a.v || a.order - b.order);
  const max = Math.max(1, frame[0]?.v ?? 1);
  const rank = new Map(frame.map((r, i) => [r.name, i]));
  const rowH = Math.max(18, Math.min(52, Math.floor(boardH / Math.max(1, seriesNames.length))));
  const month = data?.months[Math.round(pos)];
  const leader = leaders[Math.round(pos)];
  const [, , caption] = MODES.find(([m]) => m === mode)!;

  return createPortal(
    <div ref={root} className="fixed inset-0 z-[80] flex flex-col bg-bg text-ink">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line px-6">
        <div className="text-[15px] font-semibold">Who led, month by month</div>
        <Choice value={mode} options={MODES.map(([m, l]) => [m, l])} onChange={setMode} />
        <div className="ml-auto flex items-center gap-3">
          <Choice value={String(speed)} options={SPEEDS.map((s) => [String(s), `${s}×`])} onChange={(s) => setSpeed(Number(s))} />
          <button onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink" title="Close (Esc)">
            <X size={18} />
          </button>
        </div>
      </header>

      {!data ? (
        <div className="flex flex-1 items-center justify-center text-ink-3">{q.loading ? 'Loading…' : 'No messages in this selection.'}</div>
      ) : (
        <>
          <div className="relative flex min-h-0 flex-1 gap-8 px-8 pb-4 pt-6">
            <div ref={board} className="relative min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
              <div className="relative" style={{ height: seriesNames.length * rowH }}>
                {frame.map((r) => (
                  <Row key={r.name} name={r.name} value={r.v} share={r.v / max} y={rank.get(r.name)! * rowH} h={rowH} rank={rank.get(r.name)! + 1} />
                ))}
              </div>
            </div>
            <aside className="pointer-events-none hidden w-[300px] shrink-0 flex-col justify-end pb-2 text-right lg:flex">
              {leader?.name && (
                <div className="mb-6">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-ink-3">Leading</div>
                  <div className="mt-1.5 flex items-center justify-end gap-2.5">
                    <span className="truncate text-[20px] font-semibold">{leader.name}</span>
                    <Badge name={leader.name} size={30} />
                  </div>
                  <div className="num mt-1 text-[12px] text-ink-3">
                    {leader.run === 1 ? 'took the lead this month' : `${leader.run} months in a row`}
                  </div>
                </div>
              )}
              <div className="text-[13px] text-ink-3">{caption}</div>
              <div className="num text-[72px] font-semibold leading-none tracking-tight text-ink">{month != null ? monthName.format(month) : ''}</div>
              <div className="num text-[96px] font-semibold leading-[0.9] tracking-tighter text-ink-3/60">{month != null ? new Date(month).getUTCFullYear() : ''}</div>
            </aside>
          </div>

          <footer className="flex h-24 shrink-0 items-center gap-4 border-t border-line px-6">
            <button onClick={toggle} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-white hover:opacity-90" title="Play / pause (Space)">
              {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="translate-x-px" />}
            </button>
            <button onClick={() => (seek(0), setPlaying(true))} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink" title="Restart (Home)">
              <RotateCcw size={16} />
            </button>
            <span className="num w-[72px] shrink-0 text-[12px] text-ink-2">{month != null ? monthFmt.format(month) : ''}</span>
            <Scrubber months={data.months} totals={data.totals} pos={pos} onSeek={(p) => (setPlaying(false), seek(p))} />
          </footer>
        </>
      )}
    </div>,
    document.body,
  );
}

function Row({ name, value, share, y, h, rank }: { name: string; value: number; share: number; y: number; h: number; rank: number }) {
  const { colorOf } = useConversation();
  const compact = h < 26;
  const barH = Math.max(8, Math.round(h * 0.62));
  return (
    <div
      className="absolute inset-x-0 flex items-center gap-3"
      style={{
        height: h,
        transform: `translateY(${y}px)`,
        transition: 'transform 650ms cubic-bezier(.22,.9,.24,1), opacity 400ms',
        opacity: value > 0.5 ? 1 : 0.35,
      }}
    >
      <span className="num w-7 shrink-0 text-right text-[12px] text-ink-3">{rank}</span>
      <div className="flex w-[190px] shrink-0 items-center justify-end gap-2">
        <span className={`truncate text-right ${compact ? 'text-[11px]' : 'text-[13px]'} ${rank === 1 ? 'font-semibold text-ink' : 'text-ink-2'}`}>{name}</span>
        <Badge name={name} size={Math.min(26, Math.max(14, h - 8))} />
      </div>
      <div className="relative flex min-w-0 flex-1 items-center" style={{ height: barH }}>
        <div className="h-full rounded-r-[4px]" style={{ width: `${Math.max(0.2, share * 88)}%`, background: colorOf(name) }} />
        <span className={`num ml-2 shrink-0 ${compact ? 'text-[11px]' : 'text-[13px]'} font-medium text-ink-2`}>{fmtInt(Math.round(value))}</span>
      </div>
    </div>
  );
}

/** Monthly volume as a faint area; click or drag anywhere to jump. */
function Scrubber({ months, totals, pos, onSeek }: { months: number[]; totals: number[]; pos: number; onSeek: (p: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const n = months.length - 1 || 1;
  const max = Math.max(1, ...totals);
  const W = 1000, H = 40;
  const path = `M0,${H} ` + totals.map((v, i) => `L${(i / n) * W},${H - (v / max) * (H - 2)}`).join(' ') + ` L${W},${H} Z`;
  const years = months.map((m, i) => [new Date(m).getUTCMonth() === 0, i, new Date(m).getUTCFullYear()] as const).filter(([jan]) => jan);
  const at = (e: ReactPointerEvent) => {
    const r = el.current!.getBoundingClientRect();
    onSeek(((e.clientX - r.left) / r.width) * n);
  };
  return (
    <div
      ref={el}
      className="relative h-14 min-w-0 flex-1 cursor-pointer select-none"
      onPointerDown={(e) => (e.currentTarget.setPointerCapture(e.pointerId), at(e))}
      onPointerMove={(e) => e.buttons === 1 && at(e)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-10 w-full">
        <path d={path} fill="var(--color-ink-3)" opacity={0.25} />
        <clipPath id="race-played"><rect x={0} y={0} width={(pos / n) * W} height={H} /></clipPath>
        <path d={path} fill="var(--color-accent)" opacity={0.55} clipPath="url(#race-played)" />
      </svg>
      <div className="absolute top-0 h-10 w-0.5 -translate-x-1/2 rounded bg-accent" style={{ left: `${(pos / n) * 100}%` }} />
      {years.map(([, i, y]) => (
        <span key={y} className="num absolute bottom-0 -translate-x-1/2 text-[10px] text-ink-3" style={{ left: `${(i / n) * 100}%` }}>{y}</span>
      ))}
    </div>
  );
}

function Choice<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg border border-line p-0.5">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} className={`h-7 rounded-md px-2.5 text-[12px] ${value === v ? 'bg-surface-2 font-medium text-ink' : 'text-ink-3 hover:text-ink'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
