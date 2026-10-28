import { useMemo } from 'react';
import { useQuery } from './useQuery';

type ThreadRow = {
  thread_id: number;
  title: string;
  is_group: boolean;
  participant_count: number;
  messages: number;
  my_messages: number;
  first_ts: number;
  last_ts: number;
  category: string;
};

export type ConversationRow = ThreadRow & {
  /** Messages per year across the whole export's span (for sparklines). */
  years: number[];
};

/** Every conversation with at least one message, largest first. */
export function useConversations() {
  const list = useQuery<ThreadRow>(`
    SELECT thread_id, coalesce(title, '(untitled)') AS title, is_group, participant_count, messages, my_messages,
           epoch_ms(first_ts) AS first_ts, epoch_ms(last_ts) AS last_ts, category
    FROM threads WHERE messages > 0 ORDER BY messages DESC`);
  const years = useQuery<{ thread_id: number; y: number; n: number }>(`
    SELECT thread_id, year(ts) AS y, count(*) AS n FROM messages WHERE kind <> 'system' GROUP BY 1, 2`);

  const rows = useMemo(() => {
    if (!list.data || !years.data) return null;
    const ys = years.data.map((r) => r.y);
    const y0 = Math.min(...ys);
    const span = Math.max(...ys) - y0 + 1;
    const byThread = new Map<number, number[]>();
    for (const r of years.data) {
      let arr = byThread.get(r.thread_id);
      if (!arr) byThread.set(r.thread_id, (arr = new Array(span).fill(0)));
      arr[r.y - y0] = r.n;
    }
    return list.data.map((r) => ({ ...r, years: byThread.get(r.thread_id) ?? new Array(span).fill(0) }));
  }, [list.data, years.data]);

  return { rows, error: list.error ?? years.error };
}
