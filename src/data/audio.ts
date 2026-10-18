// Sound tuning. Every audio number lives here; src/audio only reads it.
// Times are in seconds unless the key ends in Ms. Gains are linear (0..1 scale).

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
} as const;
