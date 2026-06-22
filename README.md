# @your-org/logger

Angular client-side logging and observability framework for Angular 19+ and AG Grid v33.

---

## Installation

```bash
npm install @your-org/logger
```

---

## Quick Start

### Standalone app (Angular 17+)

```ts
// app.config.ts
import { LoggerModule, LogLevel } from '@your-org/logger';

export const appConfig: ApplicationConfig = {
  providers: [
    ...LoggerModule.forRootProviders({
      level   : LogLevel.INFO,
      endpoint: '/api/logs',
    }),
  ],
};
```

### NgModule-based app

```ts
// app.module.ts
import { LoggerModule, LogLevel } from '@your-org/logger';

@NgModule({
  imports: [
    LoggerModule.forRoot({
      level   : LogLevel.INFO,
      endpoint: '/api/logs',
    }),
  ],
})
export class AppModule {}
```

---

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `level` | `LogLevel` | `INFO` | Minimum level to log |
| `endpoint` | `string` | `/api/logs` | POST endpoint for log batches |
| `batchSize` | `number` | `20` | Flush when queue reaches N entries |
| `batchMs` | `number` | `5000` | Flush every N milliseconds |
| `maxRetries` | `number` | `3` | Retry attempts on delivery failure |
| `sensitiveKeys` | `string[]` | See below | Keys redacted from HTTP payloads |

Default sensitive keys: `password, token, authorization, secret, apiKey`

---

## Usage

### General logging

```ts
import { LoggerService } from '@your-org/logger';

@Component({ ... })
export class MyComponent {
  private logger = inject(LoggerService);

  save(): void {
    this.logger.info('Order saved', { component: 'OrderComponent' });
  }

  handleError(err: Error): void {
    this.logger.error('Save failed', {
      component: 'OrderComponent',
      error: { name: err.name, message: err.message, stack: err.stack },
    });
  }
}
```

### AG Grid logging

```ts
import { GridLoggerService } from '@your-org/logger';

@Component({
  providers: [GridLoggerService],   // ← scoped per component
})
export class SalesGridComponent {
  private gridLogger = inject(GridLoggerService);

  onGridReady(params: GridReadyEvent): void {
    // Attaches all grid event listeners automatically
    this.gridLogger.onGridReady(params, 'SalesGridComponent');
  }

  private loadData(): void {
    const mark = this.gridLogger.markFetchStart();
    this.http.get('/api/data').subscribe(data => {
      this.rowData = data;
      this.gridLogger.measureFetch(mark);
    });
  }
}
```

### Interaction logging (automatic)

No code needed. `forRoot()` starts global event delegation automatically.

Every button click, dropdown selection, and text input is captured.

**Control capture with data attributes:**

```html
<!-- Custom action name -->
<button data-log-action="save-order">Save</button>

<!-- Log selected option text -->
<select data-log-action="region-filter" data-log-value="true">...</select>

<!-- Log input value explicitly (only for non-PII fields) -->
<input data-log-action="product-search" data-log-value="true" />

<!-- Opt out -->
<button data-log-ignore>Internal</button>
<div data-log-ignore><!-- nothing inside logged --></div>
```

### Runtime log level control

```ts
private logger = inject(LoggerService);

// Enable debug logging for a session
this.logger.setLevel(LogLevel.DEBUG);

// Restore to INFO
this.logger.setLevel(LogLevel.INFO);
```

---

## What is logged automatically

| Source | What | How |
|---|---|---|
| Unhandled exceptions | Error name, message, stack | `ErrorHandler` |
| Promise rejections | Error name, message, stack | `window.unhandledrejection` |
| HTTP requests | Method, URL, status, duration, byte sizes | `HttpInterceptor` |
| AG Grid state | Filter, sort, column resize/move | `GridLoggerService` |
| AG Grid interactions | Cell edits, row selection | `GridLoggerService` |
| Grid performance | Render time, data fetch duration | `GridLoggerService` |
| User interactions | Button clicks, dropdowns, inputs | Global event delegation |

---

## Security

- HTTP request/response payloads are **never logged in full** — only byte size
- `sensitiveKeys` fields are **redacted** from URL query params
- Input values are **never logged** unless explicitly opted in via `data-log-value="true"`
- Cell values in AG Grid are **never logged** (PII risk)
- User IDs should be passed as **opaque identifiers** via `logger.setUser(opaqueId)`

---

## Log delivery

Logs are batched and sent as a POST to your configured `endpoint`:

```json
{
  "batchId": "uuid",
  "sentAt" : "2025-09-15T10:42:31.004Z",
  "entries": [ ...LogEntry[] ]
}
```

Failed deliveries are retried with exponential backoff (500ms → 1s → 2s).
On page close, `navigator.sendBeacon` is used as a last resort.

---

## AG Grid peer dependency

AG Grid (`ag-grid-community`, `ag-grid-angular`) is an **optional peer dependency**.
If your team does not use AG Grid, simply don't inject `GridLoggerService`.
All other framework features work independently.
