// Single shared DuckDB-WASM instance. Every view in the app reads from it.
import * as duckdb from '@duckdb/duckdb-wasm';
import mvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

export interface Engine {
  db: duckdb.AsyncDuckDB;
  conn: duckdb.AsyncDuckDBConnection;
}

let engine: Promise<Engine> | null = null;

export function getEngine(): Promise<Engine> {
  engine ??= (async () => {
    const bundle = await duckdb.selectBundle({
      mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
      eh: { mainModule: ehWasm, mainWorker: ehWorker },
    });
    const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), new Worker(bundle.mainWorker!));
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    const conn = await db.connect();
    return { db, conn };
  })();
  return engine;
}

export type Row = Record<string, unknown>;

/**
 * Arrow hands back BIGINT as bigint and HUGEINT / DECIMAL (e.g. sum() results)
 * as BigNum word arrays; the UI wants plain numbers. BigNum's own numeric
 * conversion throws in arrow 17, so go through its string form.
 */
function plain(v: unknown, scale: number | undefined): unknown {
  if (typeof v === 'bigint') return Number(v);
  if (v !== null && typeof v === 'object' && ArrayBuffer.isView(v) && !(v instanceof DataView)) {
    const n = Number(BigInt(String(v)));
    return scale ? n / 10 ** scale : n;
  }
  return v;
}

export interface QueryResult<T extends Row = Row> {
  columns: { name: string; type: string }[];
  rows: T[];
  ms: number;
}

const inFlight = new Map<string, Promise<QueryResult>>();

/**
 * Runs `sql`. With a `key` (the data version it reads), an identical query
 * already in flight for that version is shared instead of queued again:
 * several panels often ask the same thing, and dev StrictMode asks twice.
 */
export function run<T extends Row = Row>(sql: string, key?: string): Promise<QueryResult<T>> {
  if (key === undefined) return exec<T>(sql);
  const k = `${key}\u0000${sql}`;
  let p = inFlight.get(k);
  if (!p) {
    p = exec(sql).finally(() => inFlight.delete(k));
    inFlight.set(k, p);
  }
  return p as Promise<QueryResult<T>>;
}

async function exec<T extends Row = Row>(sql: string): Promise<QueryResult<T>> {
  const { conn } = await getEngine();
  const t0 = performance.now();
  const table = await conn.query(sql);
  const ms = performance.now() - t0;
  if (import.meta.env.DEV && ms > 300) console.debug(`[slow query ${Math.round(ms)} ms]`, sql.trim().slice(0, 160));
  const columns = table.schema.fields.map((f) => ({ name: f.name, type: String(f.type) }));
  const scales = table.schema.fields.map((f) => (f.type as { scale?: number }).scale);
  const rows = table.toArray().map((r) => {
    const o: Row = {};
    columns.forEach((c, i) => (o[c.name] = plain(r[c.name], scales[i])));
    return o as T;
  });
  return { columns, rows, ms };
}

export async function query<T extends Row = Row>(sql: string): Promise<T[]> {
  return (await run<T>(sql)).rows;
}

/** Escapes a value for inline use in SQL. */
export function lit(v: string | number | boolean | null): string {
  if (v === null) return 'NULL';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return `'${v.replaceAll("'", "''")}'`;
}
