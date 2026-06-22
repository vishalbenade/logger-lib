// core/logger/interaction-logger.service.ts
//
// Global event delegation — attaches exactly 3 listeners on `document`
// and captures ALL user interactions via event bubbling.
//
// No directives. No per-component wiring. Works for dynamic/lazy elements.
//
// ── Two modes ─────────────────────────────────────────────────────────────────
//
//  1. AUTO-CAPTURE (default: on)
//     Every click / change / input is captured automatically.
//     Element identity resolved from tag, role, aria-label, innerText.
//
//  2. EXPLICIT via data attributes (opt-in for custom action names)
//     <button  data-log-action="save-order">Save</button>
//     <select  data-log-action="region-filter" data-log-value="true">...</select>
//     <input   data-log-action="search-query">          ← value never logged
//     <button  data-log-ignore>...</button>             ← opt out of auto-capture
//
// ── Bootstrap ─────────────────────────────────────────────────────────────────
//
//  Called once from APP_INITIALIZER in app.config.ts:
//    interactionLogger.start()

import { Injectable, NgZone, inject } from '@angular/core';
import { LoggerService }              from './logger.service';

const CLICK_TAGS  = new Set(['button', 'a', 'mat-button', 'li', 'td', 'th', 'label', 'summary']);
const CHANGE_TAGS = new Set(['select', 'input', 'textarea']);
const IGNORE_ROLES = new Set(['presentation', 'none']);

@Injectable({ providedIn: 'root' })
export class InteractionLoggerService {
  private readonly logger = inject(LoggerService);
  private readonly zone   = inject(NgZone);

  private started = false;
  private inputDebounceMap = new Map<EventTarget, ReturnType<typeof setTimeout>>();

  // ── Public ─────────────────────────────────────────────────────────────────

  start(): void {
    if (this.started) return;
    this.started = true;

    this.zone.runOutsideAngular(() => {
      document.addEventListener('click',  (e) => this.onGlobalClick(e),  { passive: true, capture: true });
      document.addEventListener('change', (e) => this.onGlobalChange(e), { passive: true, capture: true });
      document.addEventListener('input',  (e) => this.onGlobalInput(e),  { passive: true, capture: true });
    });
  }

  // ── Global click handler ───────────────────────────────────────────────────

  private onGlobalClick(e: MouseEvent): void {
    const el = e.target as HTMLElement;
    if (!el || this.shouldIgnore(el)) return;

    const action = el.getAttribute('data-log-action');
    const tag    = el.tagName.toLowerCase();

    if (action) {
      this.log('click', action, tag, this.resolveLabel(el));
      return;
    }

    if (CLICK_TAGS.has(tag) || el.getAttribute('role') === 'button') {
      this.log('click', this.resolveAction(el, 'click'), tag, this.resolveLabel(el));
    }
  }

  // ── Global change handler (select, checkbox, radio) ───────────────────────

  private onGlobalChange(e: Event): void {
    const el       = e.target as HTMLInputElement | HTMLSelectElement;
    if (!el || this.shouldIgnore(el)) return;

    const action   = el.getAttribute('data-log-action');
    const logValue = el.getAttribute('data-log-value') === 'true';
    const tag      = el.tagName.toLowerCase();
    const label    = logValue
      ? this.resolveSelectedLabel(el)
      : this.resolveLabel(el);

    this.log('change', action ?? this.resolveAction(el, 'change'), tag, label);
  }

  // ── Global input handler — debounced 500ms, value never logged ─────────────

  private onGlobalInput(e: Event): void {
    const el = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (!el || this.shouldIgnore(el)) return;

    const type = el.getAttribute('type')?.toLowerCase();
    if (type === 'checkbox' || type === 'radio') return;

    const existing = this.inputDebounceMap.get(el);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.inputDebounceMap.delete(el);
      const action = el.getAttribute('data-log-action');
      this.log('input', action ?? this.resolveAction(el, 'input'), el.tagName.toLowerCase(), this.resolveLabel(el));
    }, 500);

    this.inputDebounceMap.set(el, timer);
  }

  // ── Core log call — uses public logInteraction() ───────────────────────────

  private log(
    type   : 'click' | 'change' | 'input',
    action : string,
    element: string,
    label  : string
  ): void {
    this.logger.logInteraction({
      level      : 1,   // INFO
      category   : 'INTERACTION',
      message    : `${type}: ${action}`,
      component  : '',
      interaction: { type, action, element, label },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private resolveAction(el: HTMLElement, fallback: string): string {
    const label = this.resolveLabel(el);
    const slug  = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    return slug ? `${el.tagName.toLowerCase()}:${slug}` : fallback;
  }

  private resolveLabel(el: HTMLElement): string {
    return (
      el.getAttribute('aria-label')       ||
      el.getAttribute('title')            ||
      el.innerText?.trim().slice(0, 60)   ||
      el.getAttribute('placeholder')      ||
      el.getAttribute('name')             ||
      (el as HTMLInputElement).type       ||
      el.tagName.toLowerCase()
    );
  }

  private resolveSelectedLabel(el: HTMLInputElement | HTMLSelectElement): string {
    if (el instanceof HTMLSelectElement) {
      return el.options[el.selectedIndex]?.text?.trim() ?? '';
    }
    if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox') return el.checked ? 'checked' : 'unchecked';
      if (el.type === 'radio')    return el.getAttribute('aria-label') ?? el.value ?? '';
    }
    return this.resolveLabel(el as HTMLElement);
  }

  private shouldIgnore(el: HTMLElement): boolean {
    if (el.hasAttribute('data-log-ignore'))              return true;
    if (IGNORE_ROLES.has(el.getAttribute('role') ?? '')) return true;
    if (el.closest('[data-log-ignore]'))                 return true;
    return false;
  }
}
