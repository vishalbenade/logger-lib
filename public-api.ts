// projects/logger/src/public-api.ts
//
// Public API surface of @your-org/logger.
// ONLY what is exported here is available to consuming teams.
// Internal implementation details stay private to the library.

// Module entry point
export { LoggerModule }              from './lib/logger.module';

// Models — teams need these for typing and log level config
export { LogLevel }                  from './lib/log.model';
export type {
  LogCategory,
  InteractionType,
  LogEntry,
  LogBatch,
}                                    from './lib/log.model';

// Config — teams need LoggerConfig type + LOGGER_CONFIG token to extend/override
export { LOGGER_CONFIG }             from './lib/logger.config';
export type { LoggerConfig }         from './lib/logger.config';

// Services — teams inject these directly in their components
export { LoggerService }             from './lib/logger.service';
export { GridLoggerService }         from './lib/grid-logger.service';

// NOT exported (internal implementation — teams don't need these):
//   LogTransportService       ← internal batching/delivery detail
//   LoggerInterceptor         ← registered automatically via forRoot()
//   LoggerErrorHandler        ← registered automatically via forRoot()
//   InteractionLoggerService  ← started automatically via forRoot()
