// Gesture-unlocked game audio. Listens to the session and the feedback signals and drives the Synth.
// Constructing this creates no AudioContext: the first pointerdown or keydown does. Without an
// AudioContext constructor the controller stays a silent no-op. Never throws into the game.

import { AUDIO } from '../data/audio';
import type { GameFeedback } from '../game/context';
import type { GameSession } from '../simulation';
import { gearTickRate, humFrequency, humGain, masterTarget } from './audioMath';
import { createSynth } from './synth';
import type { Synth } from './synth';

export interface GameAudio {
  readonly unlocked: boolean;
  dispose(): void;
}

/** Window with the optional audio constructors (webkit prefix for older Safari). */
interface AudioWindow extends Window {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

const GESTURE_EVENTS = ['pointerdown', 'keydown'] as const;

/** Builds the synth from the first available AudioContext constructor, or null when impossible. */
function createAudioSynth(target: Window): Synth | null {
  try {
    const audioWindow = target as AudioWindow;
    const Ctor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!Ctor) return null;
    return createSynth(new Ctor());
  } catch (error) {
    console.warn('[gameAudio] AudioContext unavailable', error);
    return null;
  }
}

export function createGameAudio(session: GameSession, feedback: GameFeedback, target: Window = window): GameAudio {
  let synth: Synth | null = null;
  let unlocked = false;
  let failed = false; // unlock attempted and impossible: permanent no-op
  let disposed = false;
  let timer: number | null = null;
  let unsubscribers: Array<() => void> = [];
  const warned = new Set<string>();
  const doc: Document | undefined = target.document;

  /** Logs a handler failure once per handler name so a repeating fault cannot flood the console. */
  function warnOnce(where: string, error: unknown): void {
    if (warned.has(where)) return;
    warned.add(where);
    console.warn(`[gameAudio] ${where} failed`, error);
  }

  function isVisible(): boolean {
    return doc?.visibilityState === 'visible';
  }

  /** One-shot voice: plays only when unlocked and not muted. Errors are logged, never thrown. */
  function oneShot(where: string, play: (s: Synth) => void): () => void {
    return () => {
      try {
        const s = synth;
        if (s && !session.settings.muted) play(s);
      } catch (error) {
        warnOnce(where, error);
      }
    };
  }

  /** Applies the mute flag to the master bus and the wind bed. */
  function applyMute(muted: boolean): void {
    const s = synth;
    if (!s) return;
    s.setMaster(masterTarget(muted, true), AUDIO.rampSeconds);
    s.setWind(!muted);
    if (!muted && isVisible()) s.resume();
  }

  /** Update loop: hum and gear ticks follow the current ME/s. */
  function tick(): void {
    try {
      const s = synth;
      if (!s) return;
      if (session.settings.muted) {
        s.setHum(0, 0);
        s.scheduleGearTicks(0);
        return;
      }
      const ps = session.rates.perSecond;
      s.setHum(humFrequency(ps), humGain(ps));
      s.scheduleGearTicks(gearTickRate(ps));
    } catch (error) {
      warnOnce('update', error);
    }
  }

  function onVisibility(): void {
    try {
      const s = synth;
      if (!s) return;
      if (doc?.visibilityState === 'hidden') s.suspend();
      else if (isVisible() && !session.settings.muted) s.resume();
    } catch (error) {
      warnOnce('visibility', error);
    }
  }

  function onGesture(): void {
    unlock();
  }

  function removeGestureListeners(): void {
    for (const type of GESTURE_EVENTS) target.removeEventListener(type, onGesture, true);
  }

  function subscribe(): Array<() => void> {
    return [
      session.on('click', oneShot('click', (s) => s.playCrank())),
      session.on('purchase', oneShot('purchase', (s) => s.playPurchase())),
      session.on('milestone', oneShot('milestone', (s) => s.playSting())),
      feedback.partLanded.on(oneShot('partLanded', (s) => s.playClunk())),
      feedback.purchaseDenied.on(oneShot('purchaseDenied', (s) => s.playDeny())),
      session.on('settings', (settings) => {
        try {
          applyMute(settings.muted);
        } catch (error) {
          warnOnce('settings', error);
        }
      }),
    ];
  }

  /** First gesture: create the context once, then start the bus, loop and listeners. */
  function unlock(): void {
    if (unlocked || failed || disposed) return;
    removeGestureListeners();

    const created = createAudioSynth(target);
    if (!created) {
      failed = true;
      return;
    }
    synth = created;
    unlocked = true;

    try {
      const muted = session.settings.muted;
      created.setMaster(masterTarget(muted, true), AUDIO.rampSeconds);
      created.setWind(!muted);
      created.resume();
      timer = target.setInterval(tick, AUDIO.updateIntervalMs);
      doc?.addEventListener('visibilitychange', onVisibility);
      unsubscribers = subscribe();
    } catch (error) {
      warnOnce('unlock', error);
    }
  }

  for (const type of GESTURE_EVENTS) target.addEventListener(type, onGesture, true);

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    removeGestureListeners();
    if (timer !== null) {
      target.clearInterval(timer);
      timer = null;
    }
    const offs = unsubscribers;
    unsubscribers = [];
    for (const off of offs) off();
    doc?.removeEventListener('visibilitychange', onVisibility);
    const s = synth;
    synth = null;
    unlocked = false;
    if (s) {
      try {
        s.close();
      } catch (error) {
        warnOnce('dispose', error);
      }
    }
  }

  return {
    get unlocked(): boolean {
      return unlocked;
    },
    dispose,
  };
}
