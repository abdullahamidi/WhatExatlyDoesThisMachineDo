// Gesture-unlocked game audio. Listens to the session and the feedback signals and drives the Synth.
// Constructing this creates no AudioContext: the first gesture (pointer, touch, click or key) does.
// Gesture listeners stay armed until the context reports 'running', so a context that starts
// suspended is resumed by a later gesture. Without an AudioContext constructor the controller stays
// a silent no-op. Never throws into the game.

import { AUDIO } from '../data/audio';
import type { SettingsState } from '../data/types';
import { TECHNOLOGIES } from '../data/technologies';
import type { GameFeedback } from '../game/context';
import type { GameSession } from '../simulation';
import { arcRate, boilerGain, busGain, droneGain, gearTickRate, humFrequency, humGain, levelsChanged, mainsGain, masterTarget, padGain, servoGain, servoHz, windAllowed } from './audioMath';
import type { LevelSnapshot } from './audioMath';
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

const GESTURE_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;

/** A created context together with the synth that drives it. */
interface AudioHandle {
  synth: Synth;
  context: AudioContext;
}

/** Builds the synth from the first available AudioContext constructor, or null when impossible. */
function createAudioHandle(target: Window): AudioHandle | null {
  try {
    const audioWindow = target as AudioWindow;
    const Ctor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!Ctor) return null;
    const context = new Ctor();
    return { synth: createSynth(context), context };
  } catch (error) {
    console.warn('[gameAudio] AudioContext unavailable', error);
    return null;
  }
}

export function createGameAudio(session: GameSession, feedback: GameFeedback, target: Window = window): GameAudio {
  let synth: Synth | null = null;
  let context: AudioContext | null = null;
  let unlocked = false;
  let failed = false; // unlock attempted and impossible: permanent no-op
  let disposed = false;
  let gesturesArmed = false;
  let timer: number | null = null;
  let unsubscribers: Array<() => void> = [];
  let appliedLevels: LevelSnapshot | null = null; // last set pushed to the synth; the tick skips unchanged sets
  let windStopped = false; // finale windStop beat fired: wind off for the rest of the sequence (cleared when the phase is 'none')
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

  /**
   * Wind bed wanted: the ending phase allows it (none / sequence) and the windStop beat has not fired.
   * Reading the phase here means a reload in choice or postgame has no wind. The flag clears once the phase is back to 'none'.
   */
  function windWanted(): boolean {
    const phase = session.state.ending.phase;
    if (phase === 'none') windStopped = false;
    return windAllowed(phase) && !windStopped;
  }

  /**
   * Master target (mute, master volume), wind bed and the sfx / ambient bus levels from the settings.
   * Pushes to the synth only when the set changed since the last push (the tick calls this every 200 ms);
   * `force` pushes anyway (unlock, settings change, tab visible). Never resumes the context: callers decide that.
   */
  function applyLevels(settings: Readonly<SettingsState>, force = false): void {
    const s = synth;
    if (!s) return;
    const next: LevelSnapshot = {
      master: masterTarget(settings.muted, true, AUDIO.masterGain, busGain(settings.masterVolume)),
      wind: !settings.muted && windWanted(),
      sfxBus: busGain(settings.sfxVolume),
      ambientBus: busGain(settings.ambientVolume),
    };
    if (!force && !levelsChanged(appliedLevels, next)) return;
    appliedLevels = next;
    s.setMaster(next.master, AUDIO.rampSeconds);
    s.setWind(next.wind);
    s.setBusGain('sfx', next.sfxBus, AUDIO.rampSeconds);
    s.setBusGain('ambient', next.ambientBus, AUDIO.rampSeconds);
  }

  /**
   * Update loop: hum and gear ticks follow the current ME/s; mains and arcs follow EE/s; the boiler roar follows PR/s;
   * the resonance pad follows RS/s (owned spire only); the servo whirr follows the crank servo level;
   * the sub-bass drone follows XF/s (owned nullChamber only). The volume levels are checked each tick (pushed on change only).
   * Muted keeps the hum pitch and drops only its gain.
   */
  function tick(): void {
    try {
      const s = synth;
      if (!s) return;
      applyLevels(session.settings);
      const ps = session.rates.perSecond.me;
      const ee = session.rates.perSecond.ee;
      const pr = session.rates.perSecond.pr;
      const rs = session.rates.perSecond.rs;
      if (session.settings.muted) {
        s.setHum(humFrequency(ps), 0);
        s.scheduleGearTicks(0);
        s.setMains(0);
        s.scheduleArcs(0);
        s.setBoiler(0);
        s.setPad(0);
        s.setDrone(0);
        s.setServo(0, AUDIO.servo.minHz);
        return;
      }
      s.setHum(humFrequency(ps), humGain(ps));
      s.scheduleGearTicks(gearTickRate(ps));
      s.setMains(mainsGain(ee));
      s.scheduleArcs(arcRate(ee, session.state.techLevels.sparkGap >= 1));
      s.setBoiler(boilerGain(pr, session.state.techLevels.boiler >= 1));
      s.setPad(padGain(rs, session.state.techLevels[AUDIO.pad.techId] >= 1));
      s.setDrone(droneGain(session.rates.perSecond.xf, session.state.techLevels[AUDIO.drone.techId] >= 1));
      const servoLevel = session.state.techLevels[AUDIO.servo.techId];
      const servoMax = TECHNOLOGIES[AUDIO.servo.techId].maxLevel ?? 1;
      s.setServo(servoGain(servoLevel, servoMax), servoHz(servoLevel, servoMax));
    } catch (error) {
      warnOnce('update', error);
    }
  }

  function onVisibility(): void {
    try {
      const s = synth;
      if (!s) return;
      if (doc?.visibilityState === 'hidden') s.suspend();
      else if (isVisible()) {
        applyLevels(session.settings, true);
        if (!session.settings.muted) s.resume();
      }
    } catch (error) {
      warnOnce('visibility', error);
    }
  }

  /** Adds the gesture listeners once. */
  function armGestures(): void {
    if (gesturesArmed || failed || disposed) return;
    gesturesArmed = true;
    for (const type of GESTURE_EVENTS) target.addEventListener(type, onGesture, true);
  }

  /** Removes the gesture listeners once. */
  function disarmGestures(): void {
    if (!gesturesArmed) return;
    gesturesArmed = false;
    for (const type of GESTURE_EVENTS) target.removeEventListener(type, onGesture, true);
  }

  /** Gesture: unlocks on the first one, then resumes the context until it reports running. */
  function onGesture(): void {
    try {
      if (disposed || failed) return;
      if (!unlocked) unlock();
      const s = synth;
      if (!s) return;
      if (s.isRunning()) disarmGestures();
      else s.resume();
    } catch (error) {
      warnOnce('gesture', error);
    }
  }

  /** Context state changed: stop listening for gestures once running, listen again when it is not. */
  function onStateChange(): void {
    try {
      const s = synth;
      if (!s || disposed) return;
      if (s.isRunning()) disarmGestures();
      else armGestures();
    } catch (error) {
      warnOnce('statechange', error);
    }
  }

  function subscribe(): Array<() => void> {
    return [
      session.on(
        'click',
        oneShot('click', (s) => {
          s.playCrank();
          if (session.state.techLevels[AUDIO.forkPing.techId] >= 1) s.playForkPing();
        }),
      ),
      session.on('purchase', ({ id }) => {
        try {
          const s = synth;
          if (s && !session.settings.muted) {
            const era = TECHNOLOGIES[id].era;
            if (era >= 5) s.playSwell();
            else if (era >= 4) s.playForkPing();
            else if (era === 3) s.playHiss();
            else if (era === 2) s.playRelay();
            else s.playPurchase();
          }
        } catch (error) {
          warnOnce('purchase', error);
        }
      }),
      session.on('milestone', ({ id }) => {
        try {
          const s = synth;
          if (s && !session.settings.muted) {
            s.playSting();
            if (id === AUDIO.whistle.techId) s.playWhistle((AUDIO.sting.notesHz.length * AUDIO.sting.noteMs) / 1000);
            if (id === AUDIO.chord.techId) s.playChord((AUDIO.sting.notesHz.length * AUDIO.sting.noteMs) / 1000);
            if (id === AUDIO.beadTick.techId) s.playBeadTicks((AUDIO.sting.notesHz.length * AUDIO.sting.noteMs) / 1000);
          }
        } catch (error) {
          warnOnce('milestone', error);
        }
      }),
      feedback.partLanded.on(oneShot('partLanded', (s) => s.playClunk())),
      feedback.purchaseDenied.on(oneShot('purchaseDenied', (s) => s.playDeny())),
      feedback.finaleBeat.on((beat) => {
        try {
          if (beat === 'windStop') {
            windStopped = true;
            applyLevels(session.settings); // pushes the wind-off set now, not on the next tick
            return;
          }
          const s = synth;
          if (!s || session.settings.muted) return;
          if (beat === 'swell') s.playSwell();
          else if (beat === 'chord') s.playResolveChord();
          else if (beat === 'flock') s.playChirps();
        } catch (error) {
          warnOnce('finaleBeat', error);
        }
      }),
      session.on('settings', (settings) => {
        try {
          applyLevels(settings, true);
          if (!settings.muted && isVisible()) synth?.resume();
        } catch (error) {
          warnOnce('settings', error);
        }
      }),
    ];
  }

  /** First gesture: create the context once, then start the bus, loop and listeners. Does not resume. */
  function unlock(): void {
    if (unlocked || failed || disposed) return;

    const handle = createAudioHandle(target);
    if (!handle) {
      failed = true;
      disarmGestures();
      return;
    }
    synth = handle.synth;
    context = handle.context;
    unlocked = true;

    try {
      applyLevels(session.settings, true);
      timer = target.setInterval(tick, AUDIO.updateIntervalMs);
      doc?.addEventListener('visibilitychange', onVisibility);
      handle.context.addEventListener('statechange', onStateChange);
      unsubscribers = subscribe();
    } catch (error) {
      warnOnce('unlock', error);
    }
  }

  armGestures();

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    disarmGestures();
    if (timer !== null) {
      target.clearInterval(timer);
      timer = null;
    }
    const offs = unsubscribers;
    unsubscribers = [];
    for (const off of offs) off();
    doc?.removeEventListener('visibilitychange', onVisibility);
    const ctx = context;
    context = null;
    if (ctx) {
      try {
        ctx.removeEventListener('statechange', onStateChange);
      } catch (error) {
        warnOnce('dispose', error);
      }
    }
    const s = synth;
    synth = null;
    appliedLevels = null;
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
