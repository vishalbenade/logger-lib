// core/logger/logger.service.ts
//
// Central logging service. Handles:
//   - Context enrichment (session, user, route)
//   - Log level filtering
//   - Queue management (delegates flushing to LogTransportService)
//
// Public API:
//   debug / info / warn / error   → general purpose
//   logApi()                      → called by LoggerInterceptor
//   logGrid()                     → called by GridLoggerService
//   logPerf()                     → called by GridLoggerService
//   logInteraction()              → called by InteractionLoggerService

import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { NavigationEnd, Router }                 from '@angular/router';
import { filter }                                from 'rxjs/operators';
import { LogTransportService }                   from './log-transport.service';
import { LOGGER_CONFIG }                         from './logger.config';
import { LogCategory, LogEntry, LogLevel }       from './log.model';

type LogOptions = Partial<LogEntry> & { component?: string };
type CategoryEntry = Omit<LogEntry, 'id' | 'timestamp' | 'sessionId' | 'userId' | 'route'>;

@Injectable({ providedIn: 'root' })
export class LoggerService implements OnDestroy {
  private readonly transport = inject(LogTransportService);
  private readonly config    = inject(LOGGER_CONFIG);
  private readonly router    = inject(Router);
  private readonly zone      = inject(NgZone);

  private currentRoute = '/';
  private userId: string | null = null;
  private readonly sessionId = crypto.randomUUID();

  constructor() {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => (this.currentRoute = e.urlAfterRedirects));
  }

  // ── Identity ───────────────────────────────────────────────────────────────

  /** Call after login. Pass an opaque ID — never raw PII. */
  setUser(userId: string | null): void {
    this.userId = userId;
  }

  // ── General purpose ────────────────────────────────────────────────────────

  debug(message: string, opts: LogOptions = {}): void {
    this.log(LogLevel.DEBUG, 'INFO', message, opts);
  }

  info(message: string, opts: LogOptions = {}): void {
    this.log(LogLevel.INFO, 'INFO', message, opts);
  }

  warn(message: string, opts: LogOptions = {}): void {
    this.log(LogLevel.WARN, 'INFO', message, opts);
  }

  error(message: string, opts: LogOptions = {}): void {
    this.log(LogLevel.ERROR, 'ERROR', message, opts);
  }

  // ── Typed category methods (called by framework internals) ─────────────────

  /** Called by LoggerInterceptor — logs HTTP request/response */
  logApi(entry: CategoryEntry): void {
    this.log(entry.level ?? LogLevel.INFO, 'API', entry.message, entry);
  }

  /** Called by GridLoggerService — logs AG Grid state and interaction events */
  logGrid(entry: CategoryEntry): void {
    this.log(LogLevel.INFO, 'GRID', entry.message, entry);
  }

  /** Called by GridLoggerService — logs render time and data fetch duration */
  logPerf(entry: CategoryEntry): void {
    this.log(LogLevel.INFO, 'PERFORMANCE', entry.message, entry);
  }

  /** Called by InteractionLoggerService — logs button clicks, inputs, dropdowns */
  logInteraction(entry: CategoryEntry): void {
    this.log(LogLevel.INFO, 'INTERACTION', entry.message, entry);
  }

  // ── Runtime level control ──────────────────────────────────────────────────

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private log(
    level   : LogLevel,
    category: LogCategory,
    message : string,
    opts    : LogOptions = {}
  ): void {
    if (level < this.config.level) return;

    const entry: LogEntry = {
      id       : crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      sessionId: this.sessionId,
      userId   : this.userId,
      route    : this.currentRoute,
      component: opts.component ?? '',
      ...opts,
    };

    // Outside NgZone — enqueueing must never trigger change detection
    this.zone.runOutsideAngular(() => this.transport.enqueue(entry));
  }

  ngOnDestroy(): void {
    this.transport.flush();
  }
}
