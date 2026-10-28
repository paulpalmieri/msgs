// Visual building blocks for Wrapped slides. All SVG/HTML, sized for the
// portrait story frame, animated with the classes in wrapped.css.
import { useEffect, useState } from 'react';
import { Badge } from '../../ui/Badge';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Intensity 0–1 against a high percentile, so one record day doesn't flatten the rest. */
function scaler(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const cap = Math.max(1, s[Math.floor(s.length * 0.95)] ?? 1);
  return (v: number) => (v ? 0.18 + 0.82 * Math.min(1, v / cap) : 0);
}

/** A year as twelve small month calendars, or all time as years × months. */
export function Squares({ days, year }: { days: { d: number; n: number }[]; year: number | null }) {
  const level = scaler(days.map((x) => x.n));
  if (year) {
    // Twelve small wall-calendar months (Monday-first), three across: fits a portrait frame.
    const byDay = new Map(days.map((x) => [x.d, x.n]));
    return (
      <div className="grid grid-cols-3 gap-x-4 gap-y-4">
        {MONTHS.map((_, m) => {
          const firstDay = Date.UTC(year, m, 1);
          const lead = (new Date(firstDay).getUTCDay() + 6) % 7;
          const len = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
          return (
            <div key={m} className="wr-fade" style={{ animationDelay: `${0.15 + m * 0.06}s` }}>
              <div className="wr-label mb-1 text-[9px] tracking-[0.12em]">{MONTH_NAMES[m]}</div>
              <div className="grid grid-cols-7 gap-[2px]">
                {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
                {Array.from({ length: len }, (_, i) => {
                  const n = byDay.get(firstDay + i * 86_400_000) ?? 0;
                  return (
                    <span
                      key={i}
                      title={n ? `${n}` : undefined}
                      className="aspect-square rounded-[2px]"
                      style={{ background: n ? 'var(--wr-accent)' : 'rgba(255,255,255,0.07)', opacity: n ? level(n) : 1 }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  const years = [...new Set(days.map((x) => new Date(x.d).getUTCFullYear()))].sort();
  const byKey = new Map(days.map((x) => [`${new Date(x.d).getUTCFullYear()}-${new Date(x.d).getUTCMonth()}`, x.n]));
  return (
    <div className="space-y-1">
      <div className="ml-10 grid grid-cols-12 gap-1">
        {MONTHS.map((m, i) => <div key={i} className="wr-label text-center text-[8px] tracking-normal">{m}</div>)}
      </div>
      {years.map((y, yi) => (
        <div key={y} className="flex items-center gap-1">
          <span className="wr-label w-9 text-[9px] tracking-normal">{y}</span>
          <div className="grid flex-1 grid-cols-12 gap-1">
            {MONTHS.map((_, m) => {
              const n = byKey.get(`${y}-${m}`) ?? 0;
              return (
                <div
                  key={m}
                  className="wr-fade aspect-square rounded-[3px]"
                  style={{ animationDelay: `${0.15 + yi * 0.06}s`, background: n ? 'var(--wr-accent)' : 'rgba(255,255,255,0.07)', opacity: n ? level(n) : 1 }}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 24 radial bars, midnight at the top; the peak hour is solid. */
export function Clock({ hourly }: { hourly: number[] }) {
  const max = Math.max(1, ...hourly);
  const peak = hourly.indexOf(max);
  const R0 = 46, R1 = 96;
  return (
    <svg viewBox="-110 -110 220 220" className="mx-auto w-full max-w-[320px]">
      <circle r={R0 - 6} fill="none" stroke="rgba(255,255,255,0.08)" />
      {hourly.map((v, h) => {
        const a = ((h + 0.5) / 24) * Math.PI * 2 - Math.PI / 2;
        const len = (R1 - R0) * (v / max);
        const w = (Math.PI * 2 * R0) / 24 - 2;
        return (
          <g key={h} transform={`rotate(${(a * 180) / Math.PI})`}>
            <rect
              x={R0}
              y={-w / 2}
              width={Math.max(1.5, len)}
              height={w}
              rx={2}
              className="wr-fade"
              style={{ animationDelay: `${0.2 + h * 0.03}s` }}
              fill={h === peak ? 'var(--wr-accent)' : 'rgba(255,255,255,0.28)'}
            />
          </g>
        );
      })}
      {[0, 6, 12, 18].map((h) => {
        const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
        return (
          <text key={h} x={Math.cos(a) * (R0 - 16)} y={Math.sin(a) * (R0 - 16) + 3} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.45)" fontFamily="JetBrains Mono Variable, monospace">
            {String(h).padStart(2, '0')}
          </text>
        );
      })}
    </svg>
  );
}

/** The person in the middle, their closest people around them: closer and bigger = more interaction. */
export function Orbit({ center, people }: { center: string; people: { name: string; score: number }[] }) {
  const max = Math.max(1, ...people.map((p) => p.score));
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[340px]">
      {[0.62, 0.92].map((r) => (
        <div key={r} className="absolute rounded-full border border-white/10" style={{ inset: `${(1 - r) * 50}%` }} />
      ))}
      <div className="wr-scale absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <Badge name={center} size={64} className="ring-4 ring-[var(--wr-accent)]/40" />
      </div>
      {people.map((p, i) => {
        const a = (i / people.length) * Math.PI * 2 - Math.PI / 2;
        const r = 0.58 - 0.26 * (p.score / max) + 0.2; // strongest closest
        const x = 50 + Math.cos(a) * r * 50;
        const y = 50 + Math.sin(a) * r * 50;
        return (
          <div key={p.name} className="wr-scale absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${0.3 + i * 0.12}s` }}>
            <Badge name={p.name} size={Math.round(30 + 16 * (p.score / max))} />
            <span className="mt-1 max-w-24 truncate text-[12px] font-medium">{p.name.split(' ')[0]}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Donut showing a share, drawing itself in. */
export function ShareRing({ share, label }: { share: number; label: string }) {
  const [p, setP] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setP(share), 120);
    return () => clearTimeout(t);
  }, [share]);
  const R = 52, L = 2 * Math.PI * R;
  return (
    <div className="relative mx-auto w-48">
      <svg viewBox="0 0 120 120" className="-rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="10" />
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--wr-accent)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={L} strokeDashoffset={L * (1 - p)} style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.2,0.8,0.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[34px] font-bold leading-none">{(share * 100).toFixed(share < 0.1 ? 1 : 0)}%</div>
        <div className="wr-label mt-1 text-[9px]">{label}</div>
      </div>
    </div>
  );
}

export function Podium({ top, total }: { top: { name: string; n: number }[]; total: number }) {
  const order = [1, 0, 2].filter((i) => top[i]);
  const heights = [100, 72, 52];
  return (
    <div className="flex items-end justify-center gap-3">
      {order.map((i) => (
        <div key={top[i].name} className="flex w-1/3 flex-col items-center">
          <div className="wr-scale flex flex-col items-center" style={{ animationDelay: `${0.4 + (2 - i) * 0.2}s` }}>
            <Badge name={top[i].name} size={i === 0 ? 56 : 44} />
            <div className="mt-1.5 max-w-full truncate text-[14px] font-semibold">{top[i].name.split(' ')[0]}</div>
            <div className="wr-label text-[9px]">{Math.round((top[i].n / Math.max(1, total)) * 100)}%</div>
          </div>
          <div
            className="wr-grow mt-2 w-full rounded-t-md"
            style={{ height: heights[i] * 1.3, background: i === 0 ? 'var(--wr-accent)' : 'rgba(255,255,255,0.14)', animationDelay: `${0.2 + (2 - i) * 0.15}s` }}
          >
            <div className="pt-2 text-center text-[22px] font-bold" style={{ color: i === 0 ? '#050505' : 'rgba(255,255,255,0.75)' }}>{i + 1}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
