// core/logger/interaction-logger.directive.ts
//
// Single attribute directive that logs user interactions declaratively.
// Handles: button clicks, dropdown changes, input typing, checkbox/radio changes.
//
// ── Usage ─────────────────────────────────────────────────────────────────────
//
//   Button click:
//     <button logAction="save-order">Save Order</button>
//
//   Dropdown selection:
//     <select logAction="region-filter">...</select>
//
//   Input typing (debounced 500ms — value is NEVER logged, only that typing occurred):
//     <input logAction="search-query" />
//
//   Custom label (overrides auto-detected label):
//     <button logAction="delete-row" logLabel="Delete selected row">🗑</button>
//
//   Opt out of value logging explicitly (default behaviour for inputs anyway):
//     <select logAction="status-filter" logValue="true">  ← logs selected option text
//     <input  logAction="search"        logValue="false"> ← never logs value (default)
//
// ── Registration ──────────────────────────────────────────────────────────────
//
//   Add LogInteractionDirective to your shared module / standalone imports:
//
//   @Component({
//     imports: [LogInteractionDirective],
//   })
//
//   Or in a shared module:
//   @NgModule({ declarations: [LogInteractionDirective], exports: [LogInteractionDirective] })

import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  NgZone,
  OnInit,
  inject,
} from '@angular/core';
import { LoggerService }   from './logger.service';
import { LogLevel }        from './log.model';

@Directive({
  selector : '[logAction]',
  standalone: true,
})
export class LogInteractionDirective implements OnInit {
  /** Developer-defined action name. Required. e.g. 'save-order', 'region-filter' */
  @Input({ required: true }) logAction!: string;

  /**
   * Override the auto-detected label.
   * Auto-detection reads: innerText → aria-label → placeholder → element type.
   */
  @Input() logLabel = '';

  /**
   * For SELECT / CHECKBOX / RADIO: set to 'true' to log the selected option text.
   * For INPUT: always false regardless — raw typed values are never logged.
   */
  @Input() logValue = 'false';

  private readonly logger  = inject(LoggerService);
  private readonly zone    = inject(NgZone);
  private readonly elRef   = inject(ElementRef<HTMLElement>);

  private inputDebounce: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    // Bind all listeners outside NgZone so interactions never trigger
    // Angular change detection cycles
    this.zone.runOutsideAngular(() => {
      const el  = this.elRef.nativeElement;
      const tag = el.tagName.toLowerCase();

      // SELECT, CHECKBOX, RADIO → listen to change
      if (tag === 'select' || (tag === 'input' && this.isChoiceInput(el))) {
        el.addEventListener('change', (e) => this.onChangeEvent(e as Event));
      }

      // TEXT INPUT, TEXTAREA → debounced input event (never logs value)
      if (tag === 'textarea' || (tag === 'input' && !this.isChoiceInput(el))) {
        el.addEventListener('input', () => this.onInputEvent());
      }

      // BUTTON, ANCHOR, anything else → click
      if (tag === 'button' || tag === 'a' || tag === 'li') {
        el.addEventListener('click', () => this.onClickEvent());
      }

      // Fallback: anything with logAction that isn't handled above gets click
      if (!['select', 'input', 'textarea', 'button', 'a', 'li'].includes(tag)) {
        el.addEventListener('click', () => this.onClickEvent());
      }
    });
  }

  // ── HostListeners for Angular-native elements (e.g. mat-button, custom components) ──

  @HostListener('click')
  onHostClick(): void {
    const tag = this.elRef.nativeElement.tagName.toLowerCase();
    // Only handle here if not already handled natively above
    if (!['button', 'a', 'li', 'select', 'input', 'textarea'].includes(tag)) {
      this.onClickEvent();
    }
  }

  // ── Event handlers ─────────────────────────────────────────────────────────

  private onClickEvent(): void {
    this.log('click', this.resolveLabel());
  }

  private onChangeEvent(e: Event): void {
    const el    = e.target as HTMLInputElement | HTMLSelectElement;
    const label = this.logValue === 'true'
      ? this.resolveSelectedLabel(el)   // log the option text (not the value)
      : this.resolveLabel();            // just log the element label

    this.log('change', label);
  }

  private onInputEvent(): void {
    // Debounce: only log once per 500ms pause in typing
    // NEVER log the actual input value — PII risk
    if (this.inputDebounce) clearTimeout(this.inputDebounce);
    this.inputDebounce = setTimeout(() => {
      this.log('input', this.resolveLabel());
    }, 500);
  }

  // ── Core log call ──────────────────────────────────────────────────────────

  private log(type: 'click' | 'change' | 'input', label: string): void {
    const el = this.elRef.nativeElement;

    this.logger.log(LogLevel.INFO, 'INTERACTION', `${type}: ${this.logAction}`, {
      component  : el.closest('[data-component]')?.getAttribute('data-component') ?? '',
      interaction: {
        type,
        action : this.logAction,
        element: el.tagName.toLowerCase(),
        label,
      },
    });
  }

  // ── Label resolution ───────────────────────────────────────────────────────

  /**
   * Resolve a human-readable label for the element without capturing raw user input.
   * Priority: @Input logLabel → aria-label → innerText → placeholder → tag name
   */
  private resolveLabel(): string {
    if (this.logLabel) return this.logLabel;

    const el = this.elRef.nativeElement;
    return (
      el.getAttribute('aria-label')               ||
      el.getAttribute('title')                    ||
      el.innerText?.trim().slice(0, 60)           ||   // cap at 60 chars
      el.getAttribute('placeholder')              ||
      el.getAttribute('name')                     ||
      el.tagName.toLowerCase()
    );
  }

  /**
   * For SELECT: returns the visible option text (not the raw value).
   * For CHECKBOX/RADIO: returns checked state as string.
   */
  private resolveSelectedLabel(el: HTMLInputElement | HTMLSelectElement): string {
    if (el instanceof HTMLSelectElement) {
      return el.options[el.selectedIndex]?.text ?? '';
    }
    if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox') return el.checked ? 'checked' : 'unchecked';
      if (el.type === 'radio')    return el.value ?? '';
    }
    return '';
  }

  private isChoiceInput(el: HTMLElement): boolean {
    const type = (el as HTMLInputElement).type?.toLowerCase();
    return type === 'checkbox' || type === 'radio';
  }
}
