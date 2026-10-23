// Gesture-unlocked game audio. Listens to the session and the feedback signals and drives the Synth.
// Constructing this creates no AudioContext: the first gesture (pointer, touch, click or key) does.
// Gesture listeners stay armed until the context reports 'running', so a context that starts
// suspended is resumed by a later gesture. Without an AudioContext constructor the controller stays
// a silent no-op. Never throws into the game.

import { AUDIO } from '../data/audio';
import { MUSIC } from '../data/music';
import type { AudioStats, MusicThemeId } from '../data/music';
import type { SettingsState } from '../data/types';
import { TECHNOLOGIES } from '../data/technologies';
import type { GameFeedback } from '../game/context';
import type { GameSession } from '../simulation';
import { arcRate, bedTrim, boilerGain, busGain, currentEra, droneGain, gearTickRate, humFrequency, humGain, levelsChanged, mainsGain, masterTarget, padGain, servoGain, servoHz, windAllowed } from './audioMath';
import type { LevelSnapshot } from './audioMath';
import { barSeconds, crossfadeGains, duckLevel, eventsInWindow, musicAllowed, musicTheme } from './musicMath';
import { createSynth } from './synth';
import type { Synth } from './synth';

export interface GameAudio {
  readonly unlocked: boolean;
  /** Live readout for the debug hook (WP15): theme, slot gains, duck, voices, peak. All zeros and nulls before the first gesture. */
  stats(): AudioStats;
  dispose(): void;
}

/** One music slot: a theme on its own bar grid. Two slots: the active one fades in while the other fades out (D5). */
interface MusicSlot {
  theme: MusicThemeId | null;
  clockStartS: number; // AudioContext time of bar 0
  scheduledUntilS: number; // events starting before this AudioContext time are already on the synth
  gain: number; // last slot gain pushed to the synth
}

/** A crossfade in progress: the outgoing slot fades from outStartGain over MUSIC.crossfadeS (wall clock). */
interface MusicFade {
  startS: number;
  outSlot: 0 | 1;
  outStartGain: number;
}

/** Finale and milestone beats in wall-clock seconds; null = not seen since the last reset or cycle. */
interface BeatClock {
  swellS: number | null;
  chordS: number | null;
  milestoneS: number | null;
}

const SLOT_INDEXES: readonly [0, 1] = [0, 1];

function newMusicSlot(): MusicSlot {
  return { theme: null, clockStartS: 0, scheduledUntilS: 0, gain: 0 };
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
  const slots: [MusicSlot, MusicSlot] = [newMusicSlot(), newMusicSlot()];
  let activeSlot: 0 | 1 = 0; // slot of the current theme; the other one is the outgoing or idle slot
  let fade: MusicFade | null = null;
  let musicOn = false; // musicAllowed held at the last music tick; false -> true re-anchors the bar grids
  let duckNow = 1; // last duck level pushed to the synth
  let beats: BeatClock = { swellS: null, chordS: null, milestoneS: null };
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

  /** Wall clock in seconds: the finale ducks and the crossfade run on it (beats may arrive before the context exists). */
  function wallS(): number {
    return target.performance.now() / 1000;
  }

  /** Seconds since a beat, or null when the beat was not seen. */
  function sinceBeat(atS: number | null, nowS: number): number | null {
    return atS === null ? null : nowS - atS;
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
      musicBus: busGain(settings.musicVolume) * MUSIC.busGain,
    };
    if (!force && !levelsChanged(appliedLevels, next)) return;
    appliedLevels = next;
    s.setMaster(next.master, AUDIO.rampSeconds);
    s.setWind(next.wind);
    s.setBusGain('sfx', next.sfxBus, AUDIO.rampSeconds);
    s.setBusGain('ambient', next.ambientBus, AUDIO.rampSeconds);
    s.setBusGain('music', next.musicBus, AUDIO.rampSeconds);
  }

  /** Pushes a slot gain to the synth only when it changed. */
  function setSlotGain(s: Synth, slot: 0 | 1, gain: number): void {
    const state = slots[slot];
    if (Object.is(state.gain, gain)) return;
    state.gain = gain;
    s.setMusicSlotGain(slot, gain, AUDIO.updateIntervalMs / 1000);
  }

  /**
   * Starts `theme` on the idle slot at the next bar after startDelayS. The active slot becomes the outgoing one
   * and fades out from its current gain while the new slot fades in (D5). Keeps the idle slot's gain so the synth ramps from it.
   * The idle slot may still have tails fading out: they are stopped first so they do not ride the new gain.
   */
  function startTheme(s: Synth, theme: MusicThemeId, ctxNowS: number, wallNowS: number): void {
    const outSlot = activeSlot;
    const inSlot: 0 | 1 = outSlot === 0 ? 1 : 0;
    s.stopMusic(inSlot);
    const start = ctxNowS + MUSIC.startDelayS;
    const idle = slots[inSlot];
    slots[inSlot] = { theme, clockStartS: start, scheduledUntilS: start, gain: idle.gain };
    fade = { startS: wallNowS, outSlot, outStartGain: slots[outSlot].gain };
    activeSlot = inSlot;
  }

  /** Crossfade step (equal power, MUSIC.crossfadeS). Without a fade the active slot sits at unity. Retires the outgoing slot at the end. */
  function updateFade(s: Synth, wallNowS: number): void {
    const current = fade;
    if (current === null) {
      if (slots[activeSlot].theme !== null) setSlotGain(s, activeSlot, 1);
      return;
    }
    const elapsed = wallNowS - current.startS;
    const [outGain, inGain] = crossfadeGains(elapsed, MUSIC.crossfadeS);
    setSlotGain(s, current.outSlot, current.outStartGain * outGain);
    setSlotGain(s, activeSlot, inGain);
    if (elapsed >= MUSIC.crossfadeS) {
      slots[current.outSlot].theme = null;
      fade = null;
    }
  }

  /** Moves a slot's bar grid to the first bar at or after nowS, so a resume never catches up on missed bars (no burst). */
  function reanchor(slot: MusicSlot, nowS: number): void {
    if (slot.theme === null) return;
    const bar = barSeconds(MUSIC.themes[slot.theme]);
    if (!(bar > 0)) return;
    const bars = Math.max(0, Math.ceil((nowS - slot.clockStartS) / bar));
    slot.clockStartS += bars * bar;
    slot.scheduledUntilS = nowS;
  }

  /** Schedules the next lookahead window of every live slot (no repeats: each window starts where the last ended). */
  function scheduleMusic(s: Synth, nowS: number): void {
    const toS = nowS + MUSIC.lookaheadS;
    for (const index of SLOT_INDEXES) {
      const slot = slots[index];
      const theme = slot.theme;
      if (theme === null) continue;
      const fromS = Math.max(slot.scheduledUntilS, nowS);
      if (!(toS > fromS)) continue;
      const events = eventsInWindow(MUSIC.themes[theme], slot.clockStartS, fromS, toS, MUSIC.maxEventsPerCall);
      for (const ev of events) s.playMusicNote(index, theme, ev);
      slot.scheduledUntilS = toS;
    }
  }

  /**
   * Music controller, once per tick (WP15 D2-D7). Nothing is scheduled unless musicAllowed (not muted, visible, master and
   * music above 0); leaving that state stops the notes. Theme from the tech levels and ending phase (D3); a null theme
   * (sequence) keeps the current one, which the duck silences. Duck from the finale and milestone beats (D6).
   */
  function tickMusic(s: Synth): void {
    const ctx = context;
    if (ctx === null) return;
    const settings = session.settings;
    const wallNow = wallS();
    if (!musicAllowed(settings.muted, settings.masterVolume, settings.musicVolume, isVisible())) {
      if (musicOn) {
        musicOn = false;
        s.stopMusic();
      }
      return;
    }
    const ctxNow = ctx.currentTime;
    if (!musicOn) {
      musicOn = true;
      reanchor(slots[0], ctxNow);
      reanchor(slots[1], ctxNow);
    }
    const phase = session.state.ending.phase;
    const theme = musicTheme(session.state.techLevels, phase);
    if (theme !== null && theme !== slots[activeSlot].theme) startTheme(s, theme, ctxNow, wallNow);
    updateFade(s, wallNow);
    const duck = duckLevel(phase, sinceBeat(beats.swellS, wallNow), sinceBeat(beats.chordS, wallNow), sinceBeat(beats.milestoneS, wallNow));
    if (!Object.is(duck, duckNow)) {
      duckNow = duck;
      s.setMusicDuck(duck, AUDIO.updateIntervalMs / 1000);
    }
    // A suspended context has a frozen clock: scheduling waits until it runs (the grid resumes where it stopped).
    if (s.isRunning()) scheduleMusic(s, ctxNow);
  }

  /** Clears the duck timers on a new game or cycle; the theme itself falls back to mech through the normal crossfade. */
  function clearBeats(): void {
    beats = { swellS: null, chordS: null, milestoneS: null };
  }

  /**
   * Update loop: hum and gear ticks follow the current ME/s; mains and arcs follow EE/s; the boiler roar follows PR/s;
   * the resonance pad follows RS/s (owned spire only); the servo whirr follows the crank servo level;
   * the sub-bass drone follows XF/s (owned nullChamber only). The volume levels are checked each tick (pushed on change only).
   * Ambient beds are multiplied by their era trim (AUDIO.bedTrim); wind has no gain parameter in the synth (its trim
   * is 1 in every era, so nothing is lost).
   * The music controller runs before the mute branch so muting stops the notes. Muted keeps the hum pitch and drops only its gain.
   */
  function tick(): void {
    try {
      const s = synth;
      if (!s) return;
      applyLevels(session.settings);
      try {
        tickMusic(s);
      } catch (error) {
        warnOnce('music', error);
      }
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
      const era = currentEra(session.state.techLevels);
      s.setHum(humFrequency(ps), humGain(ps) * bedTrim('hum', era));
      s.scheduleGearTicks(gearTickRate(ps), bedTrim('gear', era));
      s.setMains(mainsGain(ee) * bedTrim('mains', era));
      s.scheduleArcs(arcRate(ee, session.state.techLevels.sparkGap >= 1));
      s.setBoiler(boilerGain(pr, session.state.techLevels.boiler >= 1) * bedTrim('boiler', era));
      s.setPad(padGain(rs, session.state.techLevels[AUDIO.pad.techId] >= 1) * bedTrim('pad', era));
      s.setDrone(droneGain(session.rates.perSecond.xf, session.state.techLevels[AUDIO.drone.techId] >= 1) * bedTrim('drone', era));
      const servoLevel = session.state.techLevels[AUDIO.servo.techId];
      const servoMax = TECHNOLOGIES[AUDIO.servo.techId].maxLevel ?? 1;
      s.setServo(servoGain(servoLevel, servoMax) * bedTrim('servo', era), servoHz(servoLevel, servoMax));
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
          beats.milestoneS = wallS();
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
      session.on('cycle', oneShot('cycle', (s) => s.playStamp())),
      session.on('cycle', clearBeats),
      session.on('reset', clearBeats),
      feedback.partLanded.on(oneShot('partLanded', (s) => s.playClunk())),
      feedback.purchaseDenied.on(oneShot('purchaseDenied', (s) => s.playDeny())),
      feedback.finaleBeat.on((beat) => {
        try {
          if (beat === 'swell') beats.swellS = wallS();
          else if (beat === 'chord') beats.chordS = wallS();
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
    slots[0] = newMusicSlot();
    slots[1] = newMusicSlot();
    activeSlot = 0;
    fade = null;
    musicOn = false;
    duckNow = 1;
    clearBeats();
    if (s) {
      try {
        s.stopMusic();
        s.close();
      } catch (error) {
        warnOnce('dispose', error);
      }
    }
  }

  /** Idle readout: nothing has been created yet (or the controller is disposed). */
  function idleStats(): AudioStats {
    return { unlocked: false, running: false, theme: null, slotGains: [0, 0], duck: 0, liveVoices: 0, musicVoices: 0, dropped: 0, peakDb: null };
  }

  /** Live readout for the debug hook. Never throws; reads the synth counters and the controller state. */
  function stats(): AudioStats {
    const s = synth;
    if (!s) return idleStats();
    try {
      const counters = s.stats();
      return {
        unlocked: true,
        running: s.isRunning(),
        theme: slots[activeSlot].theme,
        slotGains: [slots[0].gain, slots[1].gain],
        duck: duckNow,
        liveVoices: counters.liveVoices,
        musicVoices: counters.musicVoices,
        dropped: counters.dropped,
        peakDb: counters.peakDb,
      };
    } catch (error) {
      warnOnce('stats', error);
      return idleStats();
    }
  }

  return {
    get unlocked(): boolean {
      return unlocked;
    },
    stats,
    dispose,
  };
}
