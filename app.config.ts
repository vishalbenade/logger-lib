// app.config.ts

import { ApplicationConfig, APP_INITIALIZER, provideZoneChangeDetection } from '@angular/core';
import { provideRouter }    from '@angular/router';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
}                           from '@angular/common/http';
import { routes }                        from './app.routes';
import { globalErrorHandlerProviders }   from './core/logger/logger-error-handler';
import { LoggerInterceptor }             from './core/logger/logger.interceptor';
import { LOGGER_CONFIG }                 from './core/logger/logger.config';
import { LogLevel }                      from './core/logger/log.model';
import { InteractionLoggerService }      from './core/logger/interaction-logger.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),

    // Error handler + unhandledrejection listener
    ...globalErrorHandlerProviders,

    // HTTP logging
    { provide: HTTP_INTERCEPTORS, useClass: LoggerInterceptor, multi: true },

    // Global interaction capture — starts 3 document-level listeners
    {
      provide   : APP_INITIALIZER,
      useFactory: (interaction: InteractionLoggerService) => () => interaction.start(),
      deps      : [InteractionLoggerService],
      multi     : true,
    },

    // Logger configuration
    {
      provide : LOGGER_CONFIG,
      useValue: {
        level        : LogLevel.INFO,
        endpoint     : '/api/logs',
        batchSize    : 20,
        batchMs      : 5_000,
        maxRetries   : 3,
        sensitiveKeys: ['password', 'token', 'authorization', 'secret', 'apiKey'],
      },
    },
  ],
};
