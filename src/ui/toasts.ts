import './toasts.css';
import { TOAST_CONFIG } from '../data/notifications';
import type { ToastMessage, ToastTone } from '../data/notifications';
import type { GameSession } from '../simulation';
import { achievementMessage, messageFor, welcomeBackMessage } from './notificationRules';
import type { NotificationEvent } from './notificationRules';

// Toast stack (WP3). DOM only: no Phaser. Text is always written with textContent.

export interface Toasts {
  show(msg: ToastMessage): void;
  /** Removes every visible toast and cancels its timers. The stack stays usable. */
  clear(): void;
  destroy(): void;
}

interface ToastEntry {
  el: HTMLDivElement;
  titleEl: HTMLDivElement;
  bodyEl: HTMLDivElement;
  tone: ToastTone;
  fadeTimer: number | null;
  removeTimer: number | null;
}

export function createToasts(root: HTMLElement, config: typeof TOAST_CONFIG = TOAST_CONFIG): Toasts {
  const stack = document.createElement('div');
  stack.id = 'toast-stack';
  stack.setAttribute('aria-live', 'polite');
  root.appendChild(stack);

  // Map iteration follows insertion order, so the first entry is the oldest toast.
  const entries = new Map<string, ToastEntry>();
  let destroyed = false;

  // Cancels the fade and removal timers of one toast.
  function clearTimers(entry: ToastEntry): void {
    if (entry.fadeTimer !== null) window.clearTimeout(entry.fadeTimer);
    if (entry.removeTimer !== null) window.clearTimeout(entry.removeTimer);
    entry.fadeTimer = null;
    entry.removeTimer = null;
  }

  // Detaches a toast from the DOM and the map. Safe to call for an entry that is already gone.
  function removeEntry(key: string, entry: ToastEntry): void {
    clearTimers(entry);
    entry.el.remove();
    if (entries.get(key) === entry) entries.delete(key);
  }

  // Schedules: after durationMs fade out, then after fadeMs remove the element.
  function startTimers(key: string, entry: ToastEntry, durationMs: number): void {
    entry.fadeTimer = window.setTimeout(() => {
      entry.fadeTimer = null;
      entry.el.classList.add('is-fading');
      entry.removeTimer = window.setTimeout(() => {
        entry.removeTimer = null;
        removeEntry(key, entry);
      }, config.fadeMs);
    }, durationMs);
  }

  // Updates an existing toast in place (keeps its stack position) and restarts its timers.
  function refresh(key: string, entry: ToastEntry, msg: ToastMessage): void {
    clearTimers(entry);
    entry.el.classList.remove(`toast--${entry.tone}`);
    entry.el.classList.add(`toast--${msg.tone}`);
    entry.tone = msg.tone;
    entry.titleEl.textContent = msg.title;
    entry.bodyEl.textContent = msg.body ?? '';
    entry.bodyEl.hidden = msg.body === null;
    entry.el.classList.remove('is-fading');
    startTimers(key, entry, msg.durationMs);
  }

  // Creates a new toast at the bottom of the stack and evicts the oldest ones over the limit.
  function create(key: string, msg: ToastMessage): void {
    const el = document.createElement('div');
    el.className = `toast toast--${msg.tone}`;

    const titleEl = document.createElement('div');
    titleEl.className = 'toast-title';
    titleEl.textContent = msg.title;

    const bodyEl = document.createElement('div');
    bodyEl.className = 'toast-body';
    bodyEl.textContent = msg.body ?? '';
    bodyEl.hidden = msg.body === null;

    el.append(titleEl, bodyEl);
    const entry: ToastEntry = {
      el,
      titleEl,
      bodyEl,
      tone: msg.tone,
      fadeTimer: null,
      removeTimer: null,
    };
    stack.appendChild(el);
    entries.set(key, entry);
    startTimers(key, entry, msg.durationMs);

    while (entries.size > config.maxVisible) {
      const oldest = entries.entries().next();
      if (oldest.done) break;
      const [oldestKey, oldestEntry] = oldest.value;
      removeEntry(oldestKey, oldestEntry);
    }
  }

  return {
    show(msg: ToastMessage): void {
      if (destroyed) return;
      const existing = entries.get(msg.key);
      if (existing) {
        refresh(msg.key, existing, msg);
      } else {
        create(msg.key, msg);
      }
    },

    clear(): void {
      if (destroyed) return;
      for (const [key, entry] of [...entries]) {
        removeEntry(key, entry);
      }
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      for (const entry of entries.values()) {
        clearTimers(entry);
      }
      entries.clear();
      stack.remove();
    },
  };
}

// Sends one event through the pure rules and shows the resulting toast, if any.
function forward(toasts: Toasts, event: NotificationEvent): void {
  const msg = messageFor(event);
  if (msg !== null) toasts.show(msg);
}

// Subscribes the toast stack to the session events that deserve a toast.
export function connectNotifications(session: GameSession, toasts: Toasts): () => void {
  const unsubscribers = [
    session.on('click', () => {
      forward(toasts, { type: 'click', totalClicks: session.state.totalClicks });
    }),
    session.on('purchase', ({ id, level }) => {
      forward(toasts, { type: 'purchase', id, level });
    }),
    session.on('unlock', ({ id }) => {
      forward(toasts, { type: 'unlock', id });
    }),
    session.on('milestone', ({ id }) => {
      forward(toasts, { type: 'milestone', id });
    }),
  ];
  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}

// Shows one coalesced record toast per 'achievement' event (WP12 D5). Empty or unknown-only lists stay silent.
export function connectAchievements(session: GameSession, toasts: Toasts): () => void {
  return session.on('achievement', ({ ids }) => {
    const msg = achievementMessage(ids);
    if (msg !== null) toasts.show(msg);
  });
}

// Shows a welcome-back toast for every later 'offline' event (tab return). The boot-time report is
// shown by bootstrap from the StartupResult, because it fires before listeners exist.
export function connectOfflineNotices(session: GameSession, toasts: Toasts): () => void {
  return session.on('offline', (report) => {
    const msg = welcomeBackMessage(report);
    if (msg !== null) toasts.show(msg);
  });
}
