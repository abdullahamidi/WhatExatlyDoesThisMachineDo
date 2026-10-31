import './guidance.css';
import { HUD_BUMP, NEXT_GOAL, ONBOARDING } from '../data/ux';
import type { GameSession } from '../simulation';
import { affordableTechIds } from '../simulation/progression/affordable';
import { motionPolicy } from '../simulation/settings';
import { activePrompt, affordableBadge, anyPurchased, nextBuy, nextGoal } from './guidanceView';
import type { TechTree } from './techTree';

// WP20 HUD guidance (DOM only, no Phaser). Decorates the existing HUD: the next-goal line, the TECH INDEX
// hint callout and pulse, the affordable badge, and the frontier counter bump on click. Writes text and
// attributes only; it owns no economy state.
// WP16b-2: one prompt at a time (crank > TECH INDEX hint > next-goal line, see activePrompt). The count chip hides under the hint.

export interface GuidanceDeps { session: GameSession; techTree: Pick<TechTree, 'isOpen' | 'onOpenChange'> }
export interface Guidance { refresh(): void; destroy(): void }

// Events that can change the goal, the hint or the badge. 'click' has its own listener (it also bumps the counter).
const REFRESH_EVENTS = ['purchase', 'unlock', 'reset', 'ending', 'cycle', 'settings'] as const;

/** Write cache: `apply` runs only when the value differs from the last one applied. No DOM write otherwise. */
function cachedWrite<T>(initial: T, apply: (value: T) => void): (value: T) => void {
  let last = initial;
  return (value: T): void => {
    if (value === last) return;
    last = value;
    apply(value);
  };
}

function noop(): void {}

export function createGuidance(root: HTMLElement, deps: GuidanceDeps): Guidance {
  const panel = root.querySelector<HTMLElement>('#hud-panel');
  const buttons = root.querySelector<HTMLElement>('#hud-buttons');
  const techButton = root.querySelector<HTMLElement>('#hud-tech');
  // The HUD is missing (or not built yet): do nothing rather than throw.
  if (!panel || !buttons || !techButton) return { refresh: noop, destroy: noop };

  // Goal line: hidden until something is bought. Last child of the panel, after the cycle line.
  const goalEl = document.createElement('div');
  goalEl.id = 'hud-goal';
  goalEl.className = 'hud-goal';
  goalEl.hidden = true;
  goalEl.setAttribute('data-ready', 'false');
  const goalTitle = document.createElement('div');
  goalTitle.className = 'hud-goal-title';
  const goalDetail = document.createElement('div');
  goalDetail.className = 'hud-goal-detail';
  // NEXT BUY (WP28): a third line under the goal, written with it. Not a live region.
  const buyEl = document.createElement('div');
  buyEl.id = 'hud-goal-buy';
  buyEl.className = 'hud-goal-buy';
  buyEl.hidden = true;
  goalEl.append(goalTitle, goalDetail, buyEl);
  panel.appendChild(goalEl);

  // Hint callout above the button row. Role status, so assistive tech announces it when it appears.
  const hintEl = document.createElement('div');
  hintEl.id = 'hud-hint';
  hintEl.className = 'hud-hint';
  hintEl.setAttribute('role', 'status');
  hintEl.hidden = true;
  hintEl.textContent = ONBOARDING.techHint;
  buttons.appendChild(hintEl);

  let destroyed = false;

  // Write caches: each field touches the DOM only when its value changes (refresh runs every 250 ms).
  // -1 is never a real count, so the first refresh always writes the badge attributes.
  const setBadge = cachedWrite<number>(-1, (count) => {
    const badge = affordableBadge(count);
    techButton.setAttribute('data-affordable', badge.text);
    techButton.setAttribute('aria-label', badge.aria);
  });
  const setHint = cachedWrite<boolean>(false, (on) => {
    hintEl.hidden = !on;
    techButton.classList.toggle('is-hinted', on);
  });
  const setGoalOn = cachedWrite<boolean>(false, (on) => { goalEl.hidden = !on; });
  const setGoalTitle = cachedWrite<string>('', (text) => { goalTitle.textContent = text; });
  const setGoalDetail = cachedWrite<string>('', (text) => { goalDetail.textContent = text; });
  const setGoalReady = cachedWrite<string>('false', (value) => { goalEl.setAttribute('data-ready', value); });
  const setBuyOn = cachedWrite<boolean>(false, (on) => { buyEl.hidden = !on; });
  const setBuyText = cachedWrite<string>('', (text) => { buyEl.textContent = text; });

  function refresh(): void {
    if (destroyed) return;
    const s = deps.session.state;
    const techs = deps.session.techs;
    const maxEra = deps.session.maxEra;
    const count = affordableTechIds(s, techs, maxEra).length;
    const owned = anyPurchased(s.techLevels, techs);
    setBadge(count);
    const prompt = activePrompt({
      totalClicks: s.totalClicks,
      anyPurchased: owned,
      affordable: count,
      phase: s.ending.phase,
      treeOpen: deps.techTree.isOpen(),
      cycle: deps.session.prestige.cycle,
    });
    setHint(prompt === 'hint');
    const goal = prompt === 'goal' ? nextGoal(s, deps.session.rates, techs, maxEra) : null;
    setGoalOn(goal !== null);
    if (goal === null) {
      setBuyOn(false);
      return;
    }
    setGoalTitle(goal.title);
    setGoalDetail(goal.detail);
    setGoalReady(goal.ready ? 'true' : 'false');
    // NEXT BUY (WP28): shown with the goal line whenever a purchase is ahead.
    const buy = nextBuy(s, deps.session.rates, techs, maxEra);
    setBuyOn(buy !== null);
    if (buy !== null) setBuyText(buy.text);
  }

  // Frontier counter bump on click: scales up and settles back. Skipped when flashes are off (reduced motion).
  // Only reads the element, never its layout, so it does not force a reflow.
  function bump(): void {
    if (destroyed || !motionPolicy(deps.session.settings).flashes) return;
    const value = root.querySelector<HTMLElement>('#hud-panel .hud-row--frontier .hud-value');
    if (!value) return;
    value.animate(
      [{ transform: 'scale(1)' }, { transform: `scale(${HUD_BUMP.scale})` }, { transform: 'scale(1)' }],
      { duration: HUD_BUMP.durationMs, easing: 'ease-out' },
    );
  }

  const unsubscribes: Array<() => void> = [
    deps.session.on('click', () => { bump(); refresh(); }),
    deps.techTree.onOpenChange(() => { refresh(); }),
    ...REFRESH_EVENTS.map((type) => deps.session.on(type, refresh)),
  ];
  const timer = window.setInterval(refresh, NEXT_GOAL.refreshMs);
  refresh();

  return {
    refresh,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      window.clearInterval(timer);
      for (const unsubscribe of unsubscribes) unsubscribe();
      goalEl.remove();
      buyEl.remove();
      hintEl.remove();
      techButton.removeAttribute('data-affordable');
      techButton.removeAttribute('aria-label');
      techButton.classList.remove('is-hinted');
    },
  };
}
