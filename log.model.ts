// core/logger/log.model.ts

export enum LogLevel {
  DEBUG = 0,
  INFO  = 1,
  WARN  = 2,
  ERROR = 3,
}

export type LogCategory =
  | 'ERROR'
  | 'API'
  | 'GRID'
  | 'PERFORMANCE'
  | 'INTERACTION'       // ← added
  | 'INFO';

export type InteractionType =
  | 'click'             // button, link, icon
  | 'change'            // dropdown, checkbox, radio, toggle
  | 'input'             // text field (debounced — value never logged)
  | 'focus'
  | 'blur';

export interface LogEntry {
  id        : string;
  timestamp : string;
  level     : LogLevel;
  category  : LogCategory;
  message   : string;
  // Who / where
  sessionId : string;
  userId    : string | null;
  route     : string;
  component : string;
  // Optional payloads
  error?    : { name: string; message: string; stack: string };
  api?      : { method: string; url: string; status: number | null; durationMs: number; reqBytes: number; resBytes: number };
  grid?     : { event: string; gridId: string; detail: Record<string, unknown> };
  perf?     : { name: string; durationMs: number };
  interaction?: {
    type    : InteractionType;
    action  : string;   // developer-defined label e.g. 'save-order', 'region-filter'
    element : string;   // tag name  e.g. 'button', 'select', 'input'
    label   : string;   // visible text / aria-label — NEVER raw input value
  };
}

export interface LogBatch {
  batchId  : string;
  sentAt   : string;
  entries  : LogEntry[];
}
