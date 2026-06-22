// core/logger/logger.interceptor.ts
//
// Logs every outbound HTTP request and its response/error.
// Captures: method, URL (scrubbed), status, request size, response size, duration.
//
// Registration in app.config.ts:
//   provideHttpClient(withInterceptorsFromDi())
//   { provide: HTTP_INTERCEPTORS, useClass: LoggerInterceptor, multi: true }

import { Injectable, inject }     from '@angular/core';
import {
  HttpEvent, HttpHandler, HttpInterceptor,
  HttpRequest, HttpResponse, HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { tap, catchError }        from 'rxjs/operators';
import { LoggerService }          from './logger.service';
import { LOGGER_CONFIG }          from './logger.config';
import { SKIP_LOG }               from './log-transport.service';

@Injectable()
export class LoggerInterceptor implements HttpInterceptor {
  private readonly logger = inject(LoggerService);
  private readonly config = inject(LOGGER_CONFIG);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Skip log-ship requests to prevent infinite loop
    if (req.context.get(SKIP_LOG)) return next.handle(req);

    const start  = performance.now();
    const url    = this.scrubUrl(req.url);
    const reqBytes = this.byteSize(req.body);

    return next.handle(req).pipe(
      tap((event) => {
        if (!(event instanceof HttpResponse)) return;
        this.logger.logApi({
          level    : event.status >= 400 ? 2 : 1,
          category : 'API',
          message  : `${req.method} ${url} ${event.status}`,
          component: '',
          api: {
            method    : req.method,
            url,
            status    : event.status,
            durationMs: Math.round(performance.now() - start),
            reqBytes,
            resBytes  : this.byteSize(event.body),
          },
        });
      }),
      catchError((err: HttpErrorResponse) => {
        this.logger.logApi({
          level    : 3,  // ERROR
          category : 'API',
          message  : `${req.method} ${url} ${err.status || 'NetworkError'}`,
          component: '',
          api: {
            method    : req.method,
            url,
            status    : err.status ?? null,
            durationMs: Math.round(performance.now() - start),
            reqBytes,
            resBytes  : 0,
          },
          error: { name: err.name, message: err.message, stack: '' },
        });
        return throwError(() => err);
      })
    );
  }

  private scrubUrl(raw: string): string {
    try {
      const u       = new URL(raw, window.location.origin);
      const blocked = new Set(this.config.sensitiveKeys.map(k => k.toLowerCase()));
      u.searchParams.forEach((_, k) => {
        if (blocked.has(k.toLowerCase())) u.searchParams.set(k, '[REDACTED]');
      });
      return u.pathname + (u.search || '');
    } catch {
      return raw.split('?')[0];
    }
  }

  private byteSize(body: unknown): number {
    if (body == null) return 0;
    try { return new TextEncoder().encode(JSON.stringify(body)).length; }
    catch { return 0; }
  }
}
