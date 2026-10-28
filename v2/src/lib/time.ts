// DuckDB TIMESTAMPs are local wall-clock values; epoch_ms() of them is
// handled with UTC methods throughout so nothing shifts by the browser offset.
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** ISO order, matching DuckDB isodow(): 1 = Monday. */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const utc = (ms: number) => new Date(ms).toISOString();
export const isoDay = (ms: number) => utc(ms).slice(0, 10);
/** SQL TIMESTAMP literal for an epoch-ms wall-clock value. */
export const tsLit = (ms: number) => `TIMESTAMP '${utc(ms).replace('T', ' ').replace('Z', '')}'`;

export const hourLabel = (h: number) => `${String(h).padStart(2, '0')}h`;

/** Compact human duration: "45 s", "12 min", "3 h 20 min", "4 d 6 h", "2.3 y". */
export function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return '–';
  if (ms < MINUTE) return `${Math.round(ms / 1000)} s`;
  if (ms < HOUR) return `${Math.round(ms / MINUTE)} min`;
  if (ms < DAY) {
    const h = Math.floor(ms / HOUR), m = Math.round((ms % HOUR) / MINUTE);
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  if (ms < 365 * DAY) {
    const d = Math.floor(ms / DAY), h = Math.round((ms % DAY) / HOUR);
    return h ? `${d} d ${h} h` : `${d} d`;
  }
  return `${(ms / (365.25 * DAY)).toFixed(1)} y`;
}
