// core/logger/logger.config.ts

import { InjectionToken } from '@angular/core';
import { LogLevel }       from './log.model';

export interface LoggerConfig {
  level       : LogLevel;      // minimum level to log
  endpoint    : string;        // POST /your/log/endpoint
  batchSize   : number;        // flush when queue reaches N entries   (default: 20)
  batchMs     : number;        // flush every N milliseconds           (default: 5000)
  maxRetries  : number;        // retry attempts on failure            (default: 3)
  sensitiveKeys: string[];     // request/response keys to redact
}

export const LOGGER_CONFIG = new InjectionToken<LoggerConfig>('LOGGER_CONFIG', {
  providedIn: 'root',
  factory: (): LoggerConfig => ({
    level        : LogLevel.INFO,
    endpoint     : '/api/logs',
    batchSize    : 20,
    batchMs      : 5_000,
    maxRetries   : 3,
    sensitiveKeys: ['password', 'token', 'authorization', 'secret', 'apiKey'],
  }),
});
