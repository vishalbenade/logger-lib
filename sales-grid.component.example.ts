// features/sales/sales-grid.component.ts — example usage

import { Component, OnInit, inject } from '@angular/core';
import { HttpClient }                from '@angular/common/http';
import { AgGridAngular }             from 'ag-grid-angular';
import { ColDef, GridOptions, GridReadyEvent } from 'ag-grid-community';

import { GridLoggerService } from '../../core/logger/grid-logger.service';
import { LoggerService }     from '../../core/logger/logger.service';

@Component({
  selector  : 'app-sales-grid',
  standalone: true,
  imports   : [AgGridAngular],
  providers : [GridLoggerService],   // ← scoped per component; each grid gets its own instance
  template  : `
    <ag-grid-angular
      class="ag-theme-alpine"
      style="height: 500px;"
      [gridOptions]="gridOptions"
      [rowData]="rowData"
      [columnDefs]="colDefs"
      (gridReady)="onGridReady($event)"
    />
  `,
})
export class SalesGridComponent implements OnInit {
  private readonly gridLogger = inject(GridLoggerService);
  private readonly logger     = inject(LoggerService);
  private readonly http       = inject(HttpClient);

  protected rowData: unknown[] = [];
  protected colDefs: ColDef[]  = [
    { field: 'id',      sortable: true, filter: true },
    { field: 'product', sortable: true, filter: true },
    { field: 'amount',  sortable: true, filter: true, editable: true },
    { field: 'region',  sortable: true, filter: true },
  ];

  protected gridOptions: GridOptions = {
    context: { gridId: 'sales-grid' },
  };

  ngOnInit(): void {
    this.loadData();
  }

  protected onGridReady(params: GridReadyEvent): void {
    // One line — attaches all grid event listeners automatically
    this.gridLogger.onGridReady(params, 'SalesGridComponent');
  }

  private loadData(): void {
    const startMark = this.gridLogger.markFetchStart();

    this.http.get<unknown[]>('/api/sales').subscribe({
      next: (data) => {
        this.rowData = data;
        this.gridLogger.measureFetch(startMark);   // logs data.fetchDuration
      },
      error: (err) => {
        this.logger.error('Failed to load sales data', {
          component: 'SalesGridComponent',
          error: { name: err.name, message: err.message, stack: err.stack ?? '' },
        });
      },
    });
  }
}
