import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({ variant = 'default', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'danger' | 'ghost' }) {
  const styles = {
    default: 'border border-line bg-surface hover:bg-surface-2 text-ink',
    primary: 'bg-accent text-white hover:brightness-110',
    danger: 'border border-line bg-surface text-danger hover:bg-surface-2',
    ghost: 'text-ink-2 hover:bg-surface-2',
  }[variant];
  return <button className={`inline-flex h-7 shrink-0 items-center whitespace-nowrap gap-1.5 rounded-md px-2.5 text-[12px] font-medium disabled:opacity-50 ${styles} ${className}`} {...props} />;
}

export function Panel({ title, actions, children, className = '', bodyClassName = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={`flex min-w-0 flex-col rounded-lg border border-line bg-surface ${className}`}>
      {title && (
        <header className="flex h-9 shrink-0 items-center justify-between border-b border-line px-3">
          <h2 className="text-[12px] font-semibold text-ink">{title}</h2>
          {actions}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/**
 * A headline number. Optional `trend` draws a tiny line of the metric over the
 * selection; optional `delta` is the change vs the previous period of equal
 * length (a fraction), shown neutrally since "more" isn't always "better".
 */
export function Stat({ label, value, sub, trend, delta }: { label: string; value: ReactNode; sub?: ReactNode; trend?: number[]; delta?: number | null }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 truncate text-[11px] font-medium uppercase tracking-wide text-ink-3">{label}</div>
        {delta != null && Number.isFinite(delta) && (
          <span className="num shrink-0 rounded bg-surface-2 px-1 text-[10px] font-medium text-ink-2" title="vs the previous period of the same length">
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta * 100).toFixed(Math.abs(delta) < 0.1 ? 1 : 0)}%
          </span>
        )}
      </div>
      <div className="num mt-0.5 truncate text-[20px] font-semibold leading-tight">{value}</div>
      {trend && trend.length > 1 && <TrendLine values={trend} />}
      {sub && <div className="num mt-0.5 truncate text-[11px] text-ink-3">{sub}</div>}
    </div>
  );
}

function TrendLine({ values }: { values: number[] }) {
  const max = Math.max(1e-9, ...values), min = Math.min(...values);
  const W = 100, H = 18;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - 2 - ((v - min) / (max - min || 1)) * (H - 4)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-1 block h-[18px] w-full overflow-visible" aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--color-accent)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export interface Column<T> {
  key: string;
  label: ReactNode;
  align?: 'left' | 'right';
  width?: string;
  render?: (row: T) => ReactNode;
}

export function Table<T extends Record<string, unknown>>({ columns, rows, maxHeight }: { columns: Column<T>[]; rows: T[]; maxHeight?: number }) {
  return (
    <div className="overflow-auto" style={{ maxHeight }}>
      <table className="w-full border-collapse text-[12px]">
        <thead className="sticky top-0 bg-surface">
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width }} className={`border-b border-line px-3 py-1.5 font-medium text-ink-3 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-surface-2">
              {columns.map((c) => (
                <td key={c.key} className={`num max-w-[28rem] truncate border-b border-line/60 px-3 py-1 ${c.align === 'right' ? 'text-right' : ''}`}>
                  {c.render ? c.render(r) : formatCell(r[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(v: unknown): ReactNode {
  if (v == null) return <span className="text-ink-3">null</span>;
  if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString('en-US') : v.toFixed(3);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Inline horizontal bar used inside table cells. */
export function Bar({ value, max, label }: { value: number; max: number; label?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
      {label !== undefined && <span className="num w-16 text-right text-ink-2">{label}</span>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: readonly (T | [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-md border border-line p-0.5">
      {options.map((o) => {
        const [v, label] = Array.isArray(o) ? o : [o, o];
        return (
          <button key={v} onClick={() => onChange(v)} className={`h-5 rounded px-1.5 text-[11px] ${value === v ? 'bg-surface-2 font-medium text-ink' : 'text-ink-3 hover:text-ink'}`}>
            {label}
          </button>
        );
      })}
    </div>
  );
}
