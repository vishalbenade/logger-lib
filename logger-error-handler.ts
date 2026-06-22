// core/logger/logger-error-handler.ts
//
// Catches all unhandled Angular errors and unhandled promise rejections.
//
// Register via globalErrorHandlerProviders in app.config.ts.

import {
  APP_INITIALIZER,
  ErrorHandler,
  Injectable,
  NgZone,
  inject,
} from '@angular/core';
import { LoggerService } from './logger.service';
import { LogLevel }      from './log.model';

@Injectable()
export class LoggerErrorHandler implements ErrorHandler {
  private readonly logger = inject(LoggerService);
  private readonly zone   = inject(NgZone);

  handleError(raw: unknown): void {
    this.zone.runOutsideAngular(() => {
      const err = raw instanceof Error ? raw : new Error(String(raw));
      this.logger.error(err.message, {
        error: {
          name   : err.name,
          message: err.message,
          stack  : (err.stack ?? '').slice(0, 4096),
        },
      });
    });
    // Preserve Angular's default dev-mode console output
    console.error(raw);
  }
}

export const globalErrorHandlerProviders = [
  { provide: ErrorHandler, useClass: LoggerErrorHandler },
  {
    provide   : APP_INITIALIZER,
    useFactory: (logger: LoggerService, zone: NgZone) => () => {
      window.addEventListener('unhandledrejection', (ev) => {
        zone.runOutsideAngular(() => {
          const err = ev.reason instanceof Error ? ev.reason : new Error(String(ev.reason));
          logger.error(`UnhandledRejection: ${err.message}`, {
            error: { name: 'UnhandledRejection', message: err.message, stack: err.stack ?? '' },
          });
        });
      });
    },
    deps : [LoggerService, NgZone],
    multi: true,
  },
];
