// Raw SQL over the conversation views. Results follow the filter bar.
import { useState } from 'react';
import { useQuery } from '../db/useQuery';
import { fmtInt, fmtMs } from '../lib/format';
import { Button, Panel, Table } from '../ui/primitives';

export function SqlSection() {
  return (
    <div className="p-4">
      <QueryPanel />
    </div>
  );
}

const SAMPLE_SQL = `-- sel = current selection (all filters), ctx = no date filter, span = dates only, conv = whole conversation.
-- Also: messages, threads, participants, people, reactions, sel_reactions, span_reactions, attachments.
SELECT sender, count(*) AS messages, round(avg(words), 1) AS avg_words
FROM sel
WHERE kind = 'text'
GROUP BY sender
ORDER BY messages DESC`;

function QueryPanel() {
  const [draft, setDraft] = useState(SAMPLE_SQL);
  const [sql, setSql] = useState<string | null>(SAMPLE_SQL);
  const { result, error, loading } = useQuery(sql);
  const runIt = () => setSql(draft.trim() === sql?.trim() ? `${draft} ` : draft);
  return (
    <Panel
      title="Query"
      actions={
        <div className="flex items-center gap-3 text-ink-3">
          {result && <span className="num">{fmtInt(result.rows.length)} rows · {fmtMs(result.ms)}</span>}
          <Button variant="primary" onClick={runIt} disabled={loading}>
            Run ⌘↵
          </Button>
        </div>
      }
    >
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            runIt();
          }
        }}
        spellCheck={false}
        className="block h-40 w-full resize-y border-b border-line bg-surface-2 p-3 font-mono text-[12px] outline-none"
      />
      {error && <pre className="whitespace-pre-wrap p-3 font-mono text-[12px] text-danger">{error}</pre>}
      {result && !error && (
        <Table maxHeight={420} rows={result.rows.slice(0, 1000)} columns={result.columns.map((c) => ({ key: c.name, label: c.name }))} />
      )}
    </Panel>
  );
}
