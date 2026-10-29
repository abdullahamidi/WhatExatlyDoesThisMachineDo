// Gesture-unlocked game audio. Listens to the session and the feedback signals and drives the Synth.
// Constructing this creates no AudioContext: the first gesture (pointer, touch, click or key) does.
// Gesture listeners stay armed until the context reports 'running', so a context that starts
// suspended is resumed by a later gesture. Without an AudioContext constructor the controller stays
// a silent no-op. Never throws into the game.

import { AUDIO } from '../data/audio';
import type { PokeSoundId } from '../data/audio';
import { MUSIC } from '../data/music';
import type { AudioStats, MusicThemeId } from '../data/music';
import type { SettingsState } from '../data/types';
import { TECHNOLOGIES } from '../data/technologies';
import type { GameFeedback, WorldSound } from '../game/context';
import type { GameSession, SessionEvents } from '../simulation';
import { currentEra } from '../simulation/progression/era';
import { isSplice } from '../simulation/progression/status';
import { ambientMix, busGain, levelsChanged, masterTarget, pokePitchScale, pokeVariant, purchaseCue, windAllowed } from './audioMath';
import type { AmbientMix, LevelSnapshot } from './audioMath';
import { barSeconds, crossfadeGains, duckLevel, eventsInWindow, musicAllowed, musicTheme } from './musicMath';
import { createSynth } from './synth';
import type { Synth } from './synth';

/** Readout for the debug hook: the synth and music readout plus the last level set and ambient mix (WP15R). */
export interface GameAudioStats extends AudioStats {
  /** Last level set pushed to the synth by applyLevels; null before unlock (and after dispose). */
  readonly levels: LevelSnapshot | null;
  /** Last ambient mix pushed by tick; null before the first tick (and after dispose). */
  readonly ambient: AmbientMix | null;
  /** Blip sequences started since unlock (world voices, WP23a). Refused ones are not counted. 0 before unlock. */
  readonly worldBlips: number;
  /** Fault spawn cues started since unlock (WP27). Muted or refused spawns are not counted. 0 before unlock. */
  readonly faultSpawnCues: number;
  /** Fault clear cues started since unlock (WP27). Expire plays no cue and is not counted. 0 before unlock. */
  readonly faultClearCues: number;
  /** Find pickups (collect cues, relics included) since unlock (WP28). Spawn and expire are not counted. 0 before unlock. */
  readonly finds: number;
  /** Relic pickups since unlock (WP28): the collect cues that were FIELD NOTE relics (a subset of finds). 0 before unlock. */
  readonly relics: number;
  /** Splice wake cues since unlock (WP28), one per Splice purchase event (a BUY MAX plays and counts once). 0 before unlock. */
  readonly splices: number;
  /** Poke cues started since unlock (WP28). Muted pokes are not counted. 0 before unlock. */
  readonly pokes: number;
  /** Refused purchases since unlock (WP28): the purchaseDenied handler, which plays the existing deny cue. 0 before unlock. */
  readonly denies: number;
}

export interface GameAudio {
  readonly unlocked: boolean;
  /** Live readout for the debug hook (WP15): theme, slot gains, duck, voices, peak. All zeros and nulls before the first gesture. */
  stats(): GameAudioStats;
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

/** Seed of the poke variant and pitch hash (WP28): a fixed start, so a run's pokes follow one sequence. */
const POKE_SEED = 0x2f6b1d;

/** Speaker of a world blip (WorldSound blip kind). */
type WorldBlipSpeaker = Extract<WorldSound, { kind: 'blip' }>['speaker'];

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
  let lastMix: AmbientMix | null = null; // last ambient mix pushed by the tick (readout only)
  let weatherApplied: { wind: number; lfo: boolean; rain: number; hz: number } | null = null; // quantized wind / rain last pushed (WP26); null = nothing pushed since the gate last closed
  let windStopped = false; // finale windStop beat fired: wind off for the rest of the sequence (cleared when the phase is 'none')
  const slots: [MusicSlot, MusicSlot] = [newMusicSlot(), newMusicSlot()];
  let activeSlot: 0 | 1 = 0; // slot of the current theme; the other one is the outgoing or idle slot
  let fade: MusicFade | null = null;
  let musicOn = false; // musicAllowed held at the last music tick; false -> true re-anchors the bar grids
  let duckNow = 1; // last duck level pushed to the synth
  let beats: BeatClock = { swellS: null, chordS: null, milestoneS: null };
  let blipEndsS: number[] = []; // wall-clock end of each world blip sequence still sounding (pruned on every blip)
  let worldBlips = 0; // blip sequences started since unlock (readout)
  let faultSpawnCues = 0; // fault spawn cues started since unlock (readout, WP27)
  let faultClearCues = 0; // fault clear cues started since unlock (readout, WP27)
  let finds = 0; // Find pickups since unlock (readout, WP28)
  let relics = 0; // relic pickups since unlock (readout, WP28)
  let splices = 0; // Splice wake cues since unlock (readout, WP28)
  let pokes = 0; // poke cues since unlock (readout, WP28)
  let denies = 0; // refused purchases since unlock (readout, WP28)
  let pokeRecent: Partial<Record<PokeSoundId, number[]>> = {}; // last variant picks per poke id (WP28), oldest first
  let pokeSeed = POKE_SEED; // seeded hash state for the poke variant and pitch (WP28)
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
  function oneShot<P = unknown>(where: string, play: (s: Synth, payload: P) => void): (payload: P) => void {
    return (payload: P) => {
      try {
        const s = synth;
        if (s && !session.settings.muted) play(s, payload);
      } catch (error) {
        warnOnce(where, error);
      }
    };
  }

  /**
   * World blip (WP23a): refused while AUDIO.world.maxConcurrent sequences still sound (wall clock). A started sequence
   * is counted in worldBlips and its end is kept as now + count * gapMs + ms.
   */
  function playWorldBlip(s: Synth, speaker: WorldBlipSpeaker, count: number, reversed: boolean): void {
    const nowS = wallS();
    blipEndsS = blipEndsS.filter((endS) => endS > nowS);
    if (blipEndsS.length >= AUDIO.world.maxConcurrent) return;
    const b = AUDIO.world.blip[speaker];
    const n = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1;
    blipEndsS.push(nowS + (n * b.gapMs) / 1000 + b.ms / 1000);
    s.playBlip(speaker, count, reversed);
    worldBlips += 1;
  }

  /** Next unit in [0, 1) from the poke hash (WP28): a 32-bit LCG step, so every poke draws the same sequence per run. */
  function pokeUnit(): number {
    pokeSeed = (Math.imul(pokeSeed, 1664525) + 1013904223) >>> 0;
    return pokeSeed / 4294967296;
  }

  /**
   * Poke cue (WP28): one of the id's variants (not one of its last picks while another is free) at a pitch 1 +- pitchSpread.
   * Counted in pokes; the caller has checked mute and unlock.
   */
  function playPoke(s: Synth, id: PokeSoundId): void {
    const recent = pokeRecent[id] ?? [];
    const variant = pokeVariant(recent, AUDIO.poke.variants[id].length, pokeUnit());
    pokeRecent[id] = [...recent, variant].slice(-AUDIO.poke.avoidRecent);
    s.playPoke(id, variant, pokePitchScale(pokeUnit()));
    pokes += 1;
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
    if (!next.wind) s.setRain(0, AUDIO.rain.hzMin); // the same gate silences the rain
    weatherApplied = null;
    if (next.wind) pushWeather(s, mixNow()); // no 200 ms of full-level wind after an unmute or the unlock
    s.setBusGain('sfx', next.sfxBus, AUDIO.rampSeconds);
    s.setBusGain('ambient', next.ambientBus, AUDIO.rampSeconds);
    s.setBusGain('music', next.musicBus, AUDIO.rampSeconds);
  }

  /** Ambient mix from the live session and the world weather readout (WP26); the tick and the level pushes both read it. */
  function mixNow(): AmbientMix {
    return ambientMix({ perSecond: session.rates.perSecond, techLevels: session.state.techLevels, muted: session.settings.muted, weather: feedback.worldWeather });
  }

  /**
   * Wind and rain levels to the synth (WP26), quantized by AUDIO.weatherStep: a push happens only when a quantized level moved,
   * so a steady readout writes nothing and a drifting one makes at most two synth calls (four AudioParam writes) per tick. Closed gate (mute, choice /
   * postgame, windStop): applyLevels has already silenced both beds, so nothing is pushed and the next open pushes at once.
   */
  function pushWeather(s: Synth, mix: AmbientMix): void {
    const gate = appliedLevels !== null && appliedLevels.wind;
    if (!gate) {
      weatherApplied = null;
      return;
    }
    const q = AUDIO.weatherStep;
    const wind = Math.round(mix.windGain / q.gain);
    const rain = Math.round(mix.rainGain / q.gain);
    const hz = rain === 0 ? 0 : Math.round(mix.rainHz / q.hz);
    const prev = weatherApplied;
    if (prev !== null && prev.wind === wind && prev.lfo === mix.windLfo && prev.rain === rain && prev.hz === hz) return;
    if (prev === null || prev.wind !== wind || prev.lfo !== mix.windLfo) s.setWindLevel(mix.windGain, mix.windLfo);
    if (prev === null || prev.rain !== rain || prev.hz !== hz) s.setRain(mix.rainGain, mix.rainHz);
    weatherApplied = { wind, lfo: mix.windLfo, rain, hz };
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
   * Update loop, once per tick: the levels (pushed on change only) and the music controller run first, so muting stops
   * the notes. Then the ambient mix (ambientMix, WP15R) is pushed to the beds. Mute handling, era trims and the
   * rate-to-gain curves live in ambientMix; this function only forwards its numbers to the synth and keeps the readout.
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
      const mix = mixNow();
      const gate = appliedLevels !== null && appliedLevels.wind;
      lastMix = gate ? mix : { ...mix, windGain: 0, windLfo: false, rainGain: 0 }; // readout is post-gate: no wind or rain while the gate is closed
      s.setHum(mix.humHz, mix.humGain);
      s.scheduleGearTicks(mix.gearRate, mix.gearGain);
      s.setMains(mix.mainsGain);
      s.scheduleArcs(mix.arcRate);
      s.setBoiler(mix.boilerGain);
      s.setPad(mix.padGain);
      s.setDrone(mix.droneGain);
      s.setServo(mix.servoGain, mix.servoHz);
      pushWeather(s, mix);
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
      // Cue = era of the paying resource (WP15R D1), not the era of the tech bought. A Splice (WP28) plays its wake by its own era instead.
      session.on('purchase', ({ id, res }) => {
        try {
          const s = synth;
          if (s && !session.settings.muted) {
            const def = TECHNOLOGIES[id];
            if (isSplice(def)) {
              s.playSpliceWake(def.era);
              splices += 1;
              return;
            }
            switch (purchaseCue(res)) {
              case 'purchase':
                s.playPurchase();
                break;
              case 'relay':
                s.playRelay();
                break;
              case 'hiss':
                s.playHiss();
                break;
              case 'forkPing':
                s.playForkPing();
                break;
              case 'swell':
                s.playSwell();
                break;
            }
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
      // Machine Faults (WP27): a spawn cue in the era of the session, a clear cue with a rising tick under Overdrive; expire is silent.
      session.on(
        'fault',
        oneShot('fault', (s, e: SessionEvents['fault']) => {
          if (e.kind === 'spawn') {
            s.playFaultSpawn(currentEra(session.state.techLevels));
            faultSpawnCues += 1;
          } else if (e.kind === 'clear') {
            s.playFaultClear(e.overdriveSeconds > 0);
            faultClearCues += 1;
          }
        }),
      ),
      // Finds (WP28): a chime when one spawns, a clink on pickup or the paper rustle for a relic. Expire is silent.
      session.on(
        'find',
        oneShot('find', (s, e: SessionEvents['find']) => {
          if (e.kind === 'spawn') {
            s.playFindSpawn();
          } else if (e.kind === 'collect') {
            if (e.relic) {
              s.playRelicCollect();
              relics += 1;
            } else {
              s.playFindCollect();
            }
            finds += 1;
          }
        }),
      ),
      feedback.partLanded.on(oneShot('partLanded', (s) => s.playClunk())),
      feedback.partEvolved.on(oneShot('partEvolved', (s) => s.playRefit())),
      feedback.partTorqued.on((event) => {
        try {
          const s = synth;
          if (s && !session.settings.muted) s.playTorqueTick(event.step);
        } catch (error) {
          warnOnce('partTorqued', error);
        }
      }),
      // Refused purchases (WP28): the existing deny cue, and the count of it (a refused Splice buy comes here too).
      feedback.purchaseDenied.on(
        oneShot('purchaseDenied', (s) => {
          s.playDeny();
          denies += 1;
        }),
      ),
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
      feedback.worldSound.on((sound) => {
        try {
          const s = synth;
          if (!s || session.settings.muted) return;
          switch (sound.kind) {
            case 'blip':
              playWorldBlip(s, sound.speaker, sound.count, sound.reversed);
              break;
            case 'ring':
              s.playRing();
              break;
            case 'dialTone':
              s.setDialTone(sound.on);
              break;
            case 'poke':
              playPoke(s, sound.id);
              break;
          }
        } catch (error) {
          warnOnce('worldSound', error);
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
    lastMix = null;
    weatherApplied = null;
    unlocked = false;
    slots[0] = newMusicSlot();
    slots[1] = newMusicSlot();
    activeSlot = 0;
    fade = null;
    musicOn = false;
    duckNow = 1;
    blipEndsS = [];
    worldBlips = 0;
    faultSpawnCues = 0;
    faultClearCues = 0;
    finds = 0;
    relics = 0;
    splices = 0;
    pokes = 0;
    denies = 0;
    pokeRecent = {};
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
  function idleStats(): GameAudioStats {
    return {
      unlocked: false, running: false, theme: null, slotGains: [0, 0], duck: 0, liveVoices: 0, musicVoices: 0, dropped: 0, peakDb: null, levels: null, ambient: null,
      worldBlips: 0, faultSpawnCues: 0, faultClearCues: 0, finds: 0, relics: 0, splices: 0, pokes: 0, denies: 0,
    };
  }

  /** Live readout for the debug hook. Never throws; reads the synth counters, the controller state, the last levels and mix. */
  function stats(): GameAudioStats {
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
        levels: appliedLevels,
        ambient: lastMix,
        worldBlips,
        faultSpawnCues,
        faultClearCues,
        finds,
        relics,
        splices,
        pokes,
        denies,
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
