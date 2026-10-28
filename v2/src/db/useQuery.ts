import { useContext, useEffect, useState } from 'react';
import { QueryEpochContext } from '../app/ConversationProvider';
import { useDatasetVersion } from '../app/DataProvider';
import { run, type QueryResult, type Row } from './duckdb';

export interface QueryState<T extends Row> {
  data: T[] | null;
  result: QueryResult<T> | null;
  error: string | null;
  loading: boolean;
}

/**
 * Runs `sql` against the loaded dataset; pass null to skip. Inside a
 * conversation it re-runs whenever the scoped views change.
 */
export function useQuery<T extends Row = Row>(sql: string | null): QueryState<T> {
  const version = useDatasetVersion();
  const epoch = useContext(QueryEpochContext);
  const [state, setState] = useState<QueryState<T>>({ data: null, result: null, error: null, loading: sql !== null });

  useEffect(() => {
    // Inside a conversation, wait for its views (epoch 0 = not built yet).
    if (sql === null || version === 0 || epoch === 0) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    run<T>(sql, `${version}:${epoch}`).then(
      (result) => !cancelled && setState({ data: result.rows, result, error: null, loading: false }),
      (e: unknown) => !cancelled && setState({ data: null, result: null, error: e instanceof Error ? e.message : String(e), loading: false }),
    );
    return () => {
      cancelled = true;
    };
  }, [sql, version, epoch]);

  return state;
}
