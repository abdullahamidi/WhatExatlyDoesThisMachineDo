// Sound tuning. Every audio number lives here; src/audio only reads it.
// Times are in seconds unless the key ends in Ms. Gains are linear (0..1 scale).

// Ambient beds that bedTrim scales per era (WP15).
export type BedId = 'hum' | 'gear' | 'mains' | 'boiler' | 'pad' | 'servo' | 'drone' | 'wind';

export const AUDIO = {
  // Master bus: target level, fade time when toggled, and how often the ambient loop updates.
  masterGain: 0.3,
  rampSeconds: 0.08,
  updateIntervalMs: 200,
  lookaheadSeconds: 0.3, // must exceed updateIntervalMs plus timer jitter so ticks never starve

  // Crank ratchet played on every click: short bursts spaced by tickGapMs.
  crank: { hz: 180, ticks: 3, tickGapMs: 28, decayMs: 45, gain: 0.5 },

  // Light thunk on 'purchase'.
  purchase: { hz: 140, decayMs: 120, gain: 0.45 },

  // Heavy clunk when a machine part lands (sine thump plus noise burst).
  clunk: { hz: 70, decayMs: 260, noiseGain: 0.5, gain: 0.9 },

  // Low buzz on a denied purchase: `count` pulses of `ms`, `gapMs` apart.
  deny: { hz: 90, ms: 90, count: 2, gapMs: 70, gain: 0.4 },

  // Three-note sting on 'milestone'.
  sting: { notesHz: [220, 277, 330], noteMs: 160, gain: 0.35 },

  // Ambient machine hum: frequency and gain rise with ME/s on a log curve up to maxPerSecond.
  hum: { minHz: 48, maxHz: 96, minGain: 0.04, maxGain: 0.16, refPerSecond: 1, maxPerSecond: 5000 },

  // Gear ticks in the background: rate in ticks/s rises with ME/s on the same log curve.
  gearTick: { minPerSecond: 1.5, maxPerSecond: 14, gain: 0.12, hz: 240, decayMs: 30 },

  // Wind bed: lowpassed noise with a slow gust LFO on its gain.
  wind: { gain: 0.05, lowpassHz: 420, gustPeriodS: 9, gustDepth: 0.6 },

  // Mains hum (Era II): 50 Hz fundamental plus a 100 Hz harmonic; gain rises with EE/s on a log curve.
  mains: { hz: 50, harmonicHz: 100, harmonicGain: 0.5, minGain: 0.02, maxGain: 0.09, refPerSecond: 1, maxPerSecond: 5000 },

  // Arc crackle (Era II, needs the spark gap): arcs/s rise with EE/s, capped at maxRate.
  arc: { minRate: 0.5, maxRate: 3, refPerSecond: 1, maxPerSecond: 5000, ms: 40, gain: 0.25, highpassHz: 1800 },

  // Relay click on a purchase of an Era II tech: two short square clicks.
  relay: { hz: 1200, ms: 18, gapMs: 55, gain: 0.35 },

  // Boiler roar (Era III): lowpassed noise bed; gain rises with PR/s on a log curve up to maxPerSecond. Owned boiler only.
  boiler: { lowpassHz: 160, minGain: 0.03, maxGain: 0.14, refPerSecond: 1, maxPerSecond: 100000 },

  // Steam hiss on an Era III purchase: one highpassed noise burst.
  hiss: { ms: 260, gain: 0.3, highpassHz: 2600 },

  // Milestone whistle: two sines together, attack then decay. Starts after the sting; techId is the milestone that triggers it.
  whistle: { hzA: 880, hzB: 1175, ms: 1100, attackMs: 90, gain: 0.2, techId: 'pressureVesselBlueprint' },

  // Resonance pad (Era IV): harmonic sines on baseHz with a slow LFO on the gain; gain rises with RS/s. Owned spire only.
  pad: {
    baseHz: 110,
    partials: [1, 2, 3],
    partialGains: [1, 0.5, 0.33],
    lfoHz: 0.15,
    lfoDepth: 0.35,
    minGain: 0.02,
    maxGain: 0.08,
    refPerSecond: 1,
    maxPerSecond: 100000,
    techId: 'resonatorSpire',
  },

  // Fork ping (Era IV): two sines, a decaying ring on each manual click (echoCrank owned) and on every Era IV purchase.
  forkPing: { hz: 512, partialRatio: 2.76, partialGain: 0.3, ms: 550, gain: 0.25, techId: 'echoCrank' },

  // Servo whirr (Era IV): sawtooth lowpassed, pitch and gain rise with the crank servo level (level / maxLevel).
  servo: { lowpassHz: 700, minHz: 55, maxHz: 110, minGain: 0.02, maxGain: 0.07, techId: 'crankServo' },

  // Milestone chord (Era IV): three sines at baseHz * ratios, after the sting; techId is the milestone that triggers it.
  chord: { baseHz: 110, ratios: [3, 4, 5], ms: 1200, attackMs: 250, gain: 0.18, techId: 'harmonicConvergence' },

  // Sub-bass drone (Era V): two sines (hz and hz * partialRatio) with a slow LFO on the gain; gain rises with XF/s. Owned nullChamber only.
  drone: { hz: 41, partialRatio: 2, partialGain: 0.3, lfoHz: 0.07, lfoDepth: 0.35, minGain: 0.02, maxGain: 0.09, refPerSecond: 1, maxPerSecond: 100000000, techId: 'nullChamber' },

  // Reversed swell (Era V purchase): filtered noise with a rising lowpass plus a sawtooth, one gain that rises over ms then stops hard.
  swell: { ms: 900, noiseLowpassFromHz: 300, noiseLowpassToHz: 2400, noiseGain: 0.18, sawHz: 110, sawGain: 0.12, gain: 0.3 },

  // Bead ticks (Era V milestone): `count` soft sine ticks at hz, gapMs apart, after the sting; techId is the milestone that triggers them.
  beadTick: { hz: 2200, count: 4, gapMs: 80, ms: 30, gain: 0.12, techId: 'finalAlignment' },

  // Finale resolve chord (WP13 S5): major triad plus octave (ratios 4:5:6:8 on baseHz), slow attack, long decay. One-shot on the sfx bus.
  resolveChord: { baseHz: 130.81, ratios: [4, 5, 6, 8], ms: 4000, attackMs: 900, gain: 0.14 },

  // Finale flock chirps (WP13 birds): `count` short FM-ish sine sweeps from fromHz up to toHz, each sweepMs long, gapMs apart; modHz/modDepth wobble the pitch. One-shot on the sfx bus.
  chirp: { count: 3, gapMs: 140, sweepMs: 90, fromHz: 2600, toHz: 3800, modHz: 55, modDepth: 60, gain: 0.07 },

  // Stamp (WP14 cycle start): low thump (sine dropping from thumpDropHz to thumpHz), short lowpassed rattle, then a
  // metallic click (two inharmonic sines at clickHz and clickHz * clickPartialRatio). Whole cue stays under 300 ms. One-shot on the sfx bus.
  stamp: {
    thumpHz: 60,
    thumpDropHz: 95,
    thumpMs: 180,
    thumpGain: 0.5,
    noiseMs: 80,
    noiseLowpassHz: 500,
    noiseGain: 0.18,
    clickHz: 3100,
    clickPartialRatio: 1.52,
    clickDelayMs: 30,
    clickAttackMs: 1,
    clickMs: 50,
    clickGain: 0.12,
  },

  // Ambient bed trims per era I..V (WP15 D8): older beds recede as later eras arrive. 1 = no change (before the bed exists it is 1).
  bedTrim: {
    hum: [1, 0.85, 0.7, 0.6, 0.5],
    gear: [1, 0.85, 0.7, 0.6, 0.5],
    mains: [1, 1, 0.8, 0.7, 0.6],
    boiler: [1, 1, 1, 0.8, 0.7],
    pad: [1, 1, 1, 1, 0.8],
    servo: [1, 1, 1, 1, 0.9],
    drone: [1, 1, 1, 1, 1],
    wind: [1, 1, 1, 1, 1],
  } satisfies Record<BedId, readonly [number, number, number, number, number]>,

  // Master limiter (WP15 mix): catches peaks after the master gain. Attack and release in seconds.
  limiter: { threshold: -10, knee: 6, ratio: 4, attack: 0.005, release: 0.25 },
} as const;
