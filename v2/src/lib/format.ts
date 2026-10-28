const nf = new Intl.NumberFormat('en-US');
const cf = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
// DuckDB TIMESTAMPs are local wall-clock values; epoch_ms() of them must be
// formatted in UTC or every date shifts by the browser's offset.
const df = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
const dtf = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export const fmtInt = (n: number | null | undefined) => (n == null ? '–' : nf.format(n));
export const fmtCompact = (n: number | null | undefined) => (n == null ? '–' : cf.format(n));
export const fmtPct = (x: number | null | undefined, digits = 1) => (x == null ? '–' : `${(x * 100).toFixed(digits)}%`);

export const fmtDate = (ms: number | null | undefined) => (ms == null ? '–' : df.format(new Date(ms)).replace(',', ''));
/** For real instants (e.g. import time), shown in the browser's zone. */
export const fmtDateTime = (iso: string | number) => dtf.format(new Date(iso));

export function fmtBytes(b: number | null | undefined): string {
  if (b == null) return '–';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (b >= 1024 && i < units.length - 1) (b /= 1024), i++;
  return `${b.toFixed(i ? 1 : 0)} ${units[i]}`;
}

export const fmtMs = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);
