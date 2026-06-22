// core/logger/log-transport.service.ts
//
// Handles all batching strategies and HTTP delivery with retry.
//
// Three flush triggers (whichever fires first):
//   1. Time-based  — every config.batchMs milliseconds
//   2. Size-based  — when queue reaches config.batchSize entries
//   3. Event-based — immediately on every ERROR entry

import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpContextToken } from '@angular/common/http';
import { interval, Subscription }                from 'rxjs';
import { LOGGER_CONFIG }                         from './logger.config';
import { LogBatch, LogEntry, LogLevel }          from './log.model';

/** Marks a request so the logger interceptor skips it (prevents infinite loop). */
export const SKIP_LOG = new HttpContextToken<boolean>(() => false);

@Injectable({ providedIn: 'root' })
export class LogTransportService implements OnDestroy {
  private readonly http   = inject(HttpClient);
  private readonly config = inject(LOGGER_CONFIG);
  private readonly zone   = inject(NgZone);

  private queue: LogEntry[] = [];
  private timer$!: Subscription;

  constructor() {
    this.zone.runOutsideAngular(() => {
      // Time-based flush
      this.timer$ = interval(this.config.batchMs).subscribe(() => this.flush());

      // Flush before tab closes (best-effort)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flush();
      });
    });
  }

  enqueue(entry: LogEntry): void {
    this.queue.push(entry);

    // Size-based flush
    if (this.queue.length >= this.config.batchSize) {
      this.flush();
      return;
    }

    // Event-based: flush immediately on errors
    if (entry.level === LogLevel.ERROR) {
      this.flush();
    }
  }

  flush(): void {
    if (!this.queue.length) return;

    const batch: LogBatch = {
      batchId: crypto.randomUUID(),
      sentAt : new Date().toISOString(),
      entries: this.queue.splice(0),   // drain queue atomically
    };

    this.send(batch, 0);
  }

  // ── HTTP delivery with exponential backoff ─────────────────────────────────

  private send(batch: LogBatch, attempt: number): void {
    const context = new HttpContext().set(SKIP_LOG, true);

    this.http
      .post(this.config.endpoint, batch, { context })
      .subscribe({
        error: (err) => {
          const retryable = err.status === 0 || err.status >= 500 || err.status === 429;

          if (retryable && attempt < this.config.maxRetries) {
            const delay = 500 * Math.pow(2, attempt); // 500ms → 1s → 2s
            setTimeout(() => this.send(batch, attempt + 1), delay);
          } else {
            // Last resort: sendBeacon survives page unload
            navigator.sendBeacon?.(
              this.config.endpoint,
              new Blob([JSON.stringify(batch)], { type: 'application/json' })
            );
          }
        },
      });
  }

  ngOnDestroy(): void {
    this.timer$.unsubscribe();
    this.flush();
  }
}
