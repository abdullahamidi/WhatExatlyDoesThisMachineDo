import './demoEnd.css';
import { DEMO_END, DEMO_TEXT } from '../data/demo';
import type { Edition } from '../data/edition';
import type { GameSession } from '../simulation/GameSession';
import {
  DEMO_END_IDLE,
  capReached,
  demoCardView,
  demoTeaserCaption,
  reduceDemoEnd,
  wishlistUrl,
} from './demoEndModel';
import type { DemoCardButton, DemoCardView, DemoEndDebugState, DemoEndEventType, DemoEndState } from './demoEndModel';
import { trapFocus } from './hotkeys';
import type { ModalStack } from './modalStack';

// END OF DEMO flow (WP21 T12, DOM). Lazy chunk, loaded only for the demo edition.
// Sequence: delay after the cap milestone -> final-machine teaser -> END OF DEMO card. Phase rules live in
// demoEndModel.ts; this file owns the DOM, the timers and the listeners, and releases all of them on keep / reset / destroy.
// Esc arrives only through the shared modal stack: the teaser and the card are pushed there with their close fns.

export interface DemoTeaserPort {
  play(onDone: () => void): void;
  skipToEnd(): void;
  stop(): void;
}

export interface DemoTimers {
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(handle: number): void;
  setInterval(fn: () => void, ms: number): number;
  clearInterval(handle: number): void;
}

export interface DemoEndDeps {
  session: Pick<GameSession, 'state' | 'on' | 'update'>;
  edition: Edition;
  modals: ModalStack;
  teaser: DemoTeaserPort;
  closeDialogs(): void;
  blocked(): boolean;
  openUrl(url: string): void;
  desktop: boolean;
  quit?: () => void;
  timers?: DemoTimers;
  /** Fired on every KEEP TINKERING (WP23a: starts the living-world post-cap arc). */
  onKeep?: () => void;
}

export interface DemoEnd {
  bootCheck(o: { teaser: boolean }): void;
  openCard(): void;
  isBusy(): boolean;
  debugState(): DemoEndDebugState;
  destroy(): void;
}

const WINDOW_TIMERS: DemoTimers = {
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (handle) => window.clearTimeout(handle),
  setInterval: (fn, ms) => window.setInterval(fn, ms),
  clearInterval: (handle) => window.clearInterval(handle),
};

interface ElementOptions {
  id?: string;
  className?: string;
  text?: string;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, options: ElementOptions = {}): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.id !== undefined) node.id = options.id;
  if (options.className !== undefined) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  return node;
}

function plainButton(options: ElementOptions): HTMLButtonElement {
  const node = el('button', options);
  node.type = 'button';
  return node;
}

/** Card button from the model view; hidden when the view hides it (QUIT where the shell cannot quit). */
function cardButton(view: DemoCardView, id: DemoCardButton['id'], className: string): HTMLButtonElement {
  const spec = view.buttons.find((b) => b.id === id);
  const node = plainButton({ id: `demo-${id}`, className, text: spec?.label ?? '' });
  node.hidden = spec === undefined || !spec.visible;
  return node;
}

/** Moves focus out of a layer that is about to hide, so no key lands on an invisible element. */
function blurWithin(container: HTMLElement): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement && container.contains(active)) active.blur();
}

export function createDemoEnd(root: HTMLElement, deps: DemoEndDeps): DemoEnd {
  const { session, edition, modals, teaser } = deps;
  const timers = deps.timers ?? WINDOW_TIMERS;
  const view = demoCardView(edition, deps.quit !== undefined);
  const feedback = view.feedback;

  // ---- DOM skeleton (built once) ----
  const teaserEl = el('div', { id: 'demo-teaser' });
  teaserEl.hidden = true;
  const captionEl = el('div', { id: 'demo-teaser-caption', text: demoTeaserCaption(edition.capTech) });
  captionEl.setAttribute('aria-live', 'polite');
  const teaserBox = el('div', { className: 'demo-teaser-box' });
  teaserBox.append(el('div', { id: 'demo-teaser-kicker', text: DEMO_TEXT.teaserKicker }), captionEl);
  const skipButton = plainButton({ id: 'demo-skip', text: DEMO_TEXT.skip });
  teaserEl.append(teaserBox, skipButton);

  const cardEl = el('div', { id: 'demo-end' });
  cardEl.setAttribute('role', 'dialog');
  cardEl.setAttribute('aria-modal', 'true');
  cardEl.setAttribute('aria-labelledby', 'demo-end-title');
  cardEl.setAttribute('aria-describedby', 'demo-end-body');
  const panel = el('div', { id: 'demo-end-panel' });
  const buttonRow = el('div', { className: 'demo-end-buttons' });
  const wishlistButton = cardButton(view, 'wishlist', 'demo-btn demo-btn--primary');
  const keepButton = cardButton(view, 'keep', 'demo-btn');
  const replayButton = cardButton(view, 'replay', 'demo-btn');
  const quitButton = cardButton(view, 'quit', 'demo-btn');
  buttonRow.append(wishlistButton, keepButton, replayButton, quitButton);
  const feedbackButton = plainButton({ id: 'demo-feedback', className: 'demo-link', text: feedback?.label ?? '' });
  feedbackButton.hidden = feedback === null;
  panel.append(
    el('h2', { id: 'demo-end-title', text: view.title }),
    el('p', { id: 'demo-end-body', text: view.body }),
    buttonRow,
    feedbackButton,
  );
  cardEl.appendChild(panel);
  root.append(teaserEl, cardEl);

  // ---- state ----
  let state: DemoEndState = DEMO_END_IDLE;
  let delayTimer: number | null = null;
  let holdTimer: number | null = null;
  let tickTimer: number | null = null;
  let releaseTrap: (() => void) | null = null;
  let returnFocus: HTMLElement | null = null;
  let destroyed = false;
  // Session subscriptions and DOM listeners; destroy runs them all.
  const disposers: Array<() => void> = [];

  const dispatch = (type: DemoEndEventType): void => {
    state = reduceDemoEnd(state, { type });
  };

  const listen = (node: HTMLElement, fn: () => void): void => {
    node.addEventListener('click', fn);
    disposers.push(() => node.removeEventListener('click', fn));
  };

  // ---- timers ----
  function clearDelay(): void {
    if (delayTimer !== null) timers.clearTimeout(delayTimer);
    delayTimer = null;
  }

  function clearHold(): void {
    if (holdTimer !== null) timers.clearTimeout(holdTimer);
    holdTimer = null;
  }

  function scheduleDelay(ms: number): void {
    clearDelay();
    delayTimer = timers.setTimeout(onDelay, ms);
  }

  /** Keeps the session clock moving while the World scene sleeps, so waking does not raise an offline report. */
  function startTick(): void {
    if (tickTimer === null) tickTimer = timers.setInterval(() => session.update(), DEMO_END.tickMs);
  }

  function stopTick(): void {
    if (tickTimer !== null) timers.clearInterval(tickTimer);
    tickTimer = null;
  }

  // ---- focus ----
  /** Keeps the first capture: REPLAY reuses the element the player had before the first teaser. */
  function captureFocus(): void {
    if (returnFocus !== null) return;
    const active = document.activeElement;
    returnFocus = active instanceof HTMLElement && active !== document.body ? active : null;
  }

  // ---- layers ----
  function hideTeaser(): void {
    blurWithin(teaserEl);
    teaserEl.hidden = true;
    modals.remove(DEMO_END.teaserStackId);
  }

  function hideCardUi(): void {
    blurWithin(cardEl);
    cardEl.classList.remove('is-open');
    releaseTrap?.();
    releaseTrap = null;
    modals.remove(DEMO_END.cardStackId);
  }

  // ---- flow ----
  function startTeaserUi(): void {
    // Close first: closing the tech tree or menu hands focus to its opener; capturing earlier would keep a node inside the hidden overlay.
    deps.closeDialogs();
    captureFocus();
    root.classList.add('demo-teaser-on');
    teaserEl.hidden = false;
    skipButton.focus();
    modals.push(DEMO_END.teaserStackId, skip);
    startTick();
    teaser.play(onTeaserDone);
  }

  function showCard(): void {
    // A teaser done callback fired inside skipToEnd would leave a hold timer behind; the card ends the teaser.
    clearHold();
    hideTeaser();
    captureFocus();
    cardEl.classList.add('is-open');
    releaseTrap?.();
    releaseTrap = trapFocus(cardEl);
    modals.push(DEMO_END.cardStackId, keep);
    // A card opened from the SYSTEM row or boot has no teaser behind it: no root lock, no tick.
    if (!state.fromTeaser) {
      root.classList.remove('demo-teaser-on');
      stopTick();
    }
    wishlistButton.focus();
  }

  function onDelay(): void {
    delayTimer = null;
    if (state.phase !== 'waiting') return;
    if (deps.blocked()) {
      scheduleDelay(DEMO_END.blockedRetryMs);
      return;
    }
    dispatch('delayElapsed');
    startTeaserUi();
  }

  function onTeaserDone(): void {
    if (state.phase !== 'teaser' || holdTimer !== null) return;
    holdTimer = timers.setTimeout(() => {
      holdTimer = null;
      if (state.phase !== 'teaser') return;
      dispatch('teaserDone');
      showCard();
    }, DEMO_END.holdEndMs);
  }

  function skip(): void {
    if (state.phase !== 'teaser') return;
    clearHold();
    teaser.skipToEnd();
    dispatch('skip');
    showCard();
  }

  function keep(): void {
    if (state.phase !== 'card') return;
    hideCardUi();
    root.classList.remove('demo-teaser-on');
    teaser.stop();
    stopTick();
    dispatch('keep');
    deps.onKeep?.();
    const target = returnFocus;
    returnFocus = null;
    if (target !== null && target.isConnected) target.focus();
  }

  function replay(): void {
    if (state.phase !== 'card') return;
    hideCardUi();
    dispatch('replay');
    startTeaserUi();
  }

  /** Releases timers, layers, stack entries and the focus trap. Shared by the reset event and destroy. */
  function clearUi(): void {
    clearDelay();
    clearHold();
    stopTick();
    hideTeaser();
    hideCardUi();
    root.classList.remove('demo-teaser-on');
    returnFocus = null;
  }

  function openCard(): void {
    if (destroyed || state.phase === 'teaser') return;
    if (state.phase === 'card') {
      wishlistButton.focus();
      return;
    }
    clearDelay();
    dispatch('openCard');
    showCard();
  }

  function bootCheck(o: { teaser: boolean }): void {
    if (destroyed || state.phase !== 'idle' || !capReached(session.state.techLevels, edition.capTech)) return;
    if (o.teaser) {
      dispatch('capReached');
      dispatch('delayElapsed');
      startTeaserUi();
    } else {
      openCard();
    }
  }

  function isBusy(): boolean {
    return state.phase === 'teaser' || state.phase === 'card';
  }

  function debugState(): DemoEndDebugState {
    return {
      edition: edition.id,
      phase: state.phase,
      capReached: capReached(session.state.techLevels, edition.capTech),
      cardOpen: cardEl.classList.contains('is-open'),
      teaserActive: !teaserEl.hidden,
      caption: captionEl.textContent ?? '',
    };
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    if (state.phase === 'teaser' || state.phase === 'card') teaser.stop();
    clearUi();
    dispatch('reset');
    for (const dispose of disposers) dispose();
    teaserEl.remove();
    cardEl.remove();
  }

  // ---- wiring ----
  // One listener on the layer: the SKIP chip's click bubbles here.
  listen(teaserEl, skip);
  listen(wishlistButton, () => deps.openUrl(wishlistUrl(edition, deps.desktop)));
  listen(keepButton, keep);
  listen(replayButton, replay);
  listen(quitButton, () => deps.quit?.());
  listen(feedbackButton, () => {
    if (feedback !== null) deps.openUrl(feedback.url);
  });

  disposers.push(
    session.on('milestone', (payload) => {
      if (payload.id !== edition.capTech || state.phase !== 'idle') return;
      dispatch('capReached');
      scheduleDelay(DEMO_END.triggerDelayMs);
    }),
  );
  disposers.push(
    session.on('reset', () => {
      teaser.stop();
      clearUi();
      dispatch('reset');
    }),
  );

  return { bootCheck, openCard, isBusy, debugState, destroy };
}
