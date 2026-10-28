// Shape of a Facebook / Instagram `message_N.json` file (fields we read).
export interface RawThreadFile {
  title?: string;
  thread_path: string;
  is_still_participant?: boolean;
  joinable_mode?: unknown;
  participants: { name: string }[];
  messages: RawMessage[];
}

interface RawUri {
  uri: string;
  creation_timestamp?: number;
}

export interface RawMessage {
  sender_name: string;
  timestamp_ms: number;
  content?: string;
  reactions?: { reaction: string; actor: string; timestamp?: number }[];
  photos?: RawUri[];
  videos?: RawUri[];
  gifs?: RawUri[];
  audio_files?: RawUri[];
  files?: RawUri[];
  sticker?: RawUri;
  share?: { link?: string; share_text?: string };
  call_duration?: number;
  missed?: boolean;
  is_unsent?: boolean;
}

export type MessageKind =
  | 'text' | 'photo' | 'video' | 'gif' | 'sticker' | 'audio' | 'file'
  | 'link' | 'call' | 'unsent' | 'system' | 'other';

export type AttachmentType = 'photo' | 'video' | 'gif' | 'audio' | 'file' | 'sticker';

/** Column-oriented output of the parser, one object per DuckDB table. */
export interface ParsedDataset {
  owner: string | null;
  files: number;
  threads: {
    thread_id: Int32Array;
    thread_key: string[];
    title: string[];
    category: string[];
    platform: string[];
    is_still_participant: boolean[];
    participant_count: Int32Array;
  };
  participants: { thread_id: Int32Array; name: string[] };
  messages: {
    message_id: Int32Array;
    thread_id: Int32Array;
    ts_ms: Float64Array;
    ts_local_ms: Float64Array;
    sender: string[];
    is_me: boolean[];
    kind: string[];
    text: (string | null)[];
    chars: Int32Array;
    words: Int32Array;
    n_attachments: Int32Array;
    link: (string | null)[];
    call_duration: (number | null)[];
    call_missed: (boolean | null)[];
    n_reactions: Int32Array;
  };
  reactions: {
    message_id: Int32Array;
    thread_id: Int32Array;
    actor: string[];
    reaction: string[];
    ts_ms: (number | null)[];
  };
  attachments: {
    message_id: Int32Array;
    thread_id: Int32Array;
    type: string[];
    uri: string[];
  };
}
