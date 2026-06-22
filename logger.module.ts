// projects/logger/src/lib/logger.module.ts
//
// Angular library entry module.
// Consuming apps import LoggerModule.forRoot(config) once in app.config.ts or AppModule.
//
// ── Usage in consuming app ────────────────────────────────────────────────────
//
//  Standalone (Angular 17+):
//
//    import { LoggerModule } from '@your-org/logger';
//
//    export const appConfig: ApplicationConfig = {
//      providers: [
//        ...LoggerModule.forRoot({
//          level   : LogLevel.INFO,
//          endpoint: '/api/logs',
//        }),
//      ],
//    };
//
//  NgModule-based:
//
//    @NgModule({
//      imports: [LoggerModule.forRoot({ level: LogLevel.INFO, endpoint: '/api/logs' })]
//    })
//    export class AppModule {}

import {
  APP_INITIALIZER,
  EnvironmentProviders,
  ErrorHandler,
  ModuleWithProviders,
  NgModule,
  makeEnvironmentProviders,
} from '@angular/core';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';

import { LOGGER_CONFIG, LoggerConfig }     from './logger.config';
import { LoggerService }                   from './logger.service';
import { LogTransportService }             from './log-transport.service';
import { LoggerInterceptor }               from './logger.interceptor';
import { LoggerErrorHandler }              from './logger-error-handler';
import { InteractionLoggerService }        from './interaction-logger.service';
import { GridLoggerService }               from './grid-logger.service';
import { LogLevel }                        from './log.model';

/** Default config — consuming apps only need to override what they care about */
const DEFAULT_CONFIG: LoggerConfig = {
  level        : LogLevel.INFO,
  endpoint     : '/api/logs',
  batchSize    : 20,
  batchMs      : 5_000,
  maxRetries   : 3,
  sensitiveKeys: ['password', 'token', 'authorization', 'secret', 'apiKey'],
};

@NgModule({})
export class LoggerModule {

  /**
   * Call once at the root level with your configuration.
   * Never call forRoot() in lazy-loaded or feature modules.
   *
   * @param config Partial config — merged with defaults
   */
  static forRoot(config: Partial<LoggerConfig> = {}): ModuleWithProviders<LoggerModule> {
    return {
      ngModule : LoggerModule,
      providers: buildProviders(config),
    };
  }

  /**
   * For Angular standalone apps — returns EnvironmentProviders
   * for use in app.config.ts providers array.
   *
   * @param config Partial config — merged with defaults
   */
  static forRootProviders(config: Partial<LoggerConfig> = {}): EnvironmentProviders {
    return makeEnvironmentProviders(buildProviders(config));
  }
}

// ── Shared provider factory ────────────────────────────────────────────────────

function buildProviders(config: Partial<LoggerConfig>) {
  const mergedConfig: LoggerConfig = { ...DEFAULT_CONFIG, ...config };

  return [
    // Config token
    {
      provide : LOGGER_CONFIG,
      useValue: mergedConfig,
    },

    // Core services (root-level singletons)
    LoggerService,
    LogTransportService,
    InteractionLoggerService,

    // GridLoggerService is NOT provided here — it is component-scoped.
    // Consuming teams add it to their component's providers array:
    //   @Component({ providers: [GridLoggerService] })

    // Global error handler
    {
      provide : ErrorHandler,
      useClass: LoggerErrorHandler,
    },

    // HTTP interceptor
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide : HTTP_INTERCEPTORS,
      useClass: LoggerInterceptor,
      multi   : true,
    },

    // Bootstrap interaction capture + unhandledrejection listener
    {
      provide   : APP_INITIALIZER,
      useFactory: (interaction: InteractionLoggerService) => () => interaction.start(),
      deps      : [InteractionLoggerService],
      multi     : true,
    },
  ];
}
