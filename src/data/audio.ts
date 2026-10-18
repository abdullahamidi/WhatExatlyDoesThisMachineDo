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
} as const;
