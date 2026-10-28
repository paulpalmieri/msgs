// Serialises parsed columns as Arrow IPC streams, the cheapest way into DuckDB.
import { tableFromArrays, tableToIPC } from 'apache-arrow';
import type { ParsedDataset } from './types';

export type TableName = 'threads' | 'participants' | 'messages' | 'reactions' | 'attachments';
export const TABLES: TableName[] = ['threads', 'participants', 'messages', 'reactions', 'attachments'];

export function datasetToIPC(ds: ParsedDataset): Record<TableName, Uint8Array> {
  const out = {} as Record<TableName, Uint8Array>;
  for (const name of TABLES) {
    // tableFromArrays infers Utf8 / Bool / Float64 (nullable) from plain arrays.
    out[name] = tableToIPC(tableFromArrays(ds[name] as Parameters<typeof tableFromArrays>[0]), 'stream');
  }
  return out;
}
