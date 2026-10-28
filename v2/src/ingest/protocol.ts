import type { TableName } from './arrow';

/** One message JSON file, either picked by the user or served by the dev plugin. */
export type Source = { path: string; file: File } | { path: string; url: string };

export type WorkerRequest = { type: 'parse'; sources: Source[] };

export interface ParseSummary {
  owner: string | null;
  files: number;
  rawMessages: number;
  messages: number;
  threads: number;
  parseMs: number;
}

export type WorkerResponse =
  | { type: 'progress'; done: number; total: number; messages: number }
  | { type: 'done'; ipc: Record<TableName, Uint8Array>; summary: ParseSummary }
  | { type: 'error'; message: string };
