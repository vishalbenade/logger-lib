// core/logger/grid-logger.service.ts
//
// Attach to any AG Grid component to automatically log:
//   State changes  : filterChanged, sortChanged, columnResized, columnMoved
//   Interactions   : cellValueChanged, rowSelected, selectionChanged
//   Performance    : firstDataRendered (render time), data fetch duration
//
// Usage:
//   @Component({ providers: [GridLoggerService] })   ← scoped per component
//   export class MyGridComponent {
//     private gridLogger = inject(GridLoggerService);
//
//     onGridReady(params: GridReadyEvent) {
//       this.gridLogger.attach(params.api, 'my-grid-id', 'MyGridComponent');
//     }
//   }

import { Injectable, NgZone, inject } from '@angular/core';
import { GridApi, GridReadyEvent }    from 'ag-grid-community';
import { LoggerService }              from './logger.service';

@Injectable()
export class GridLoggerService {
  private readonly logger = inject(LoggerService);
  private readonly zone   = inject(NgZone);

  private api!: GridApi;
  private gridId!: string;
  private component!: string;
  private readyMark!: string;

  // ── Attach ─────────────────────────────────────────────────────────────────

  attach(api: GridApi, gridId: string, component: string): void {
    this.api       = api;
    this.gridId    = gridId;
    this.component = component;
    this.readyMark = `grid_ready_${gridId}`;

    performance.mark(this.readyMark);

    // All listeners outside NgZone — zero change-detection impact
    this.zone.runOutsideAngular(() => {
      this.listenStateEvents();
      this.listenInteractionEvents();
      this.listenPerfEvents();
    });
  }

  /** Convenience — call from (gridReady) output binding */
  onGridReady(params: GridReadyEvent, component: string): void {
    const gridId = (params.context as { gridId?: string })?.gridId ?? 'unknown';
    this.attach(params.api, gridId, component);
  }

  // ── Mark/measure data fetch ────────────────────────────────────────────────

  /** Call before your HTTP data request */
  markFetchStart(): string {
    const mark = `fetch_${this.gridId}_${Date.now()}`;
    performance.mark(mark);
    return mark;
  }

  /** Call after row data is set on the grid */
  measureFetch(startMark: string): void {
    try {
      const m = performance.measure(`fetch_duration_${this.gridId}`, startMark);
      this.logger.logPerf({
        level    : 1,
        category : 'PERFORMANCE',
        message  : 'Data fetch complete',
        component: this.component,
        perf     : { name: 'data.fetchDuration', durationMs: Math.round(m.duration) },
      });
      performance.clearMarks(startMark);
    } catch { /* mark may not exist in test environments */ }
  }

  // ── State events ───────────────────────────────────────────────────────────

  private listenStateEvents(): void {
    // filterChanged — debounced 300ms to avoid keystroke flooding
    let filterTimer: ReturnType<typeof setTimeout>;
    this.api.addEventListener('filterChanged', () => {
      clearTimeout(filterTimer);
      filterTimer = setTimeout(() => this.logGridEvent('filterChanged', {
        rowCount   : this.api.getDisplayedRowCount(),
        filterModel: this.api.getFilterModel(),
      }), 300);
    });

    this.api.addEventListener('sortChanged', () =>
      this.logGridEvent('sortChanged', {
        sortModel: this.api.getColumnState()
          .filter(c => !!c.sort)
          .map(c => ({ colId: c.colId, sort: c.sort })),
      })
    );

    // columnResized — only log on drag finish (finished = true)
    this.api.addEventListener('columnResized', (e: any) => {
      if (!e.finished) return;
      this.logGridEvent('columnResized', {
        columnId: e.column?.getId(),
        newWidth: e.column?.getActualWidth(),
      });
    });

    this.api.addEventListener('columnMoved', (e: any) =>
      this.logGridEvent('columnMoved', {
        columnId: e.column?.getId(),
        toIndex : e.toIndex,
      })
    );
  }

  // ── Interaction events ─────────────────────────────────────────────────────

  private listenInteractionEvents(): void {
    // cellValueChanged — log column + row index only, NEVER cell values (PII risk)
    this.api.addEventListener('cellValueChanged', (e: any) =>
      this.logGridEvent('cellValueChanged', {
        columnId: e.column?.getId(),
        rowIndex: e.rowIndex,
      })
    );

    // rowSelected — DEBUG level; high frequency on bulk operations
    this.api.addEventListener('rowSelected', (e: any) =>
      this.logger.debug('Row selected', {
        component: this.component,
        grid: { event: 'rowSelected', gridId: this.gridId,
                detail: { rowIndex: e.rowIndex, selected: e.node?.isSelected() } },
      })
    );

    // selectionChanged — aggregated; prefer this in production dashboards
    this.api.addEventListener('selectionChanged', () =>
      this.logGridEvent('selectionChanged', {
        selectedCount: this.api.getSelectedRows().length,
      })
    );
  }

  // ── Performance events ─────────────────────────────────────────────────────

  private listenPerfEvents(): void {
    this.api.addEventListener('firstDataRendered', () => {
      try {
        const m = performance.measure(`grid_render_${this.gridId}`, this.readyMark);
        this.logger.logPerf({
          level    : 1,
          category : 'PERFORMANCE',
          message  : 'Grid render complete',
          component: this.component,
          perf     : { name: 'grid.renderTime', durationMs: Math.round(m.duration) },
        });
        performance.clearMarks(this.readyMark);
      } catch { /* safe to ignore */ }
    });
  }

  // ── Helper ─────────────────────────────────────────────────────────────────

  private logGridEvent(event: string, detail: Record<string, unknown>): void {
    this.logger.logGrid({
      level    : 1,
      category : 'GRID',
      message  : `Grid: ${event}`,
      component: this.component,
      grid     : { event, gridId: this.gridId, detail },
    });
  }
}
