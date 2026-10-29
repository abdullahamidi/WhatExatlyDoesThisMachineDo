// Sound tuning. Every audio number lives here; src/audio only reads it.
// Times are in seconds unless the key ends in Ms. Gains are linear (0..1 scale).

// Ambient beds that bedTrim scales per era (WP15).
export type BedId = 'hum' | 'gear' | 'mains' | 'boiler' | 'pad' | 'servo' | 'drone' | 'wind' | 'rain';

// One-shot cue on a purchase; chosen by the era of the paying resource (see AUDIO.purchaseCueByEra).
export type PurchaseCue = 'purchase' | 'relay' | 'hiss' | 'forkPing' | 'swell';

// Machine Fault spawn cue shape by era (AUDIO.faultSpawn.flavourByEra, WP27).
export type FaultFlavour = 'crackle' | 'hiss' | 'ping' | 'static';

// Poke sound ids (WP28): one per poke reaction family, two variants each (AUDIO.poke).
export type PokeSoundId = 'tick' | 'pencil' | 'woof' | 'caw' | 'beep' | 'ring' | 'tink' | 'note' | 'organ' | 'bell' | 'crackle' | 'buzz';
// A cue part (WP28): [source, hz, atMs, ms, gain, fromHz?]. A tone wave (sine, square, triangle, sawtooth) glides from fromHz to hz over
// the first half of ms when fromHz is given; a noise burst runs through a bandpass / highpass at hz (Q AUDIO.cueQ). Times from the cue start.
export type CueSource = 'sine' | 'square' | 'triangle' | 'sawtooth' | 'bandpass' | 'highpass';
export type CuePart = readonly [CueSource, number, number, number, number, number?];
export type CueParts = readonly CuePart[];

export const AUDIO = {
  // Master bus: target level, fade time when toggled, and how often the ambient loop updates.
  masterGain: 0.3,
  rampSeconds: 0.08,
  updateIntervalMs: 200,
  lookaheadSeconds: 0.3, // must exceed updateIntervalMs plus timer jitter so ticks never starve

  // Crank ratchet played on every click: short bursts spaced by tickGapMs.
  crank: { hz: 180, ticks: 3, tickGapMs: 28, decayMs: 45, gain: 0.5 },

  // Light thunk on a purchase paid with ME (purchaseCueByEra[0]).
  purchase: { hz: 140, decayMs: 120, gain: 0.45 },
  // Purchase cue by the era of the PAYING resource (WP15R D1): index = RESOURCES[costRes].era - 1. Same rule for every tech, keystones included.
  purchaseCueByEra: ['purchase', 'relay', 'hiss', 'forkPing', 'swell'] satisfies readonly [PurchaseCue, PurchaseCue, PurchaseCue, PurchaseCue, PurchaseCue],

  // Heavy clunk when a machine part lands (sine thump plus noise burst).
  clunk: { hz: 70, decayMs: 260, noiseGain: 0.5, gain: 0.9 },

  // WP22 tier-up refit: `ticks` rising noise ratchet ticks (bandpass centre tickHz[i], bandpass Q tickQ), then an FM bell at bellAtMs (= PART_TIER_FX.settleMs).
  // FM bell: sine carrier bellHz, sine modulator bellHz x bellPartialRatio (the modulator:carrier ratio); modulation depth starts at bellIndex x modulator Hz and falls to 1 % over bellMs; peak bellGain.
  refit: { ticks: 3, tickGapMs: 85, tickMs: 26, tickHz: [820, 980, 1170], tickQ: 4, tickGain: 0.2, bellAtMs: 600, bellHz: 1560, bellPartialRatio: 2.76, bellIndex: 0.9, bellMs: 520, bellGain: 0.16 },
  // WP22 torque tick between tiers: one noise tick (bandpass Q q), pitch hz * 2^(min(step, maxStep) / 12); at most maxConcurrent at once.
  torqueTick: { hz: 700, q: 4, maxStep: 12, ms: 22, gain: 0.18, maxConcurrent: 3 },

  // Low buzz on a denied purchase: `count` pulses of `ms`, `gapMs` apart.
  deny: { hz: 90, ms: 90, count: 2, gapMs: 70, gain: 0.4 },

  // Three-note sting on 'milestone'.
  sting: { notesHz: [220, 277, 330], noteMs: 160, gain: 0.35 },

  // Ambient machine hum: frequency and gain rise with ME/s on a log curve up to maxPerSecond.
  // maxPerSecond is at least 3x the post-finale (PF) rate of that resource (WP15R D2), so the bed does not saturate.
  // WP27 P9 refit: 1000000 (the PF ME/s is about 2.8e5, so the curve sits near 0.91 there, under the 0.95 guard).
  hum: { minHz: 48, maxHz: 96, minGain: 0.04, maxGain: 0.16, refPerSecond: 1, maxPerSecond: 1000000 },

  // Gear ticks in the background: rate in ticks/s rises with ME/s on the same log curve (the hum's maxPerSecond, WP15R D2).
  gearTick: { minPerSecond: 1.5, maxPerSecond: 14, gain: 0.12, hz: 240, decayMs: 30 },

  // Wind bed: lowpassed noise with a slow gust LFO on its gain (the LFO runs only on the v0.10.0 fallback, not while the world is live).
  // refWind: world wind (0..1.5, WORLD_WEATHER.windMax) that plays the bed at full gain. floor: share of the bed that still plays in still air (eras IV-V and the finale before the wind stop; Director Q1, 2026-10-27).
  wind: { gain: 0.05, lowpassHz: 420, gustPeriodS: 9, gustDepth: 0.6, refWind: 1, floor: 0.3 },
  // Rain bed (WP26 Q2, era III): bandpassed noise, the hiss of the virga. gain 0.03 = -30.5 dB (bible: -30 dB). It plays only while the world is live.
  // alphaRef: virga alpha (tween x era ambient, 0.35-0.7 in era III) that plays the bed at full gain. speedRef: virga speed (tween x era ambient) that plays it at full gain and at hzMax.
  // hzMin / hzMax: bandpass centre in Hz; it falls to hzMin as the virga slows. q: bandpass Q. smoothS: setTargetAtTime time constant in seconds (slow, so the era IV trim step and the freeze fade out over seconds).
  rain: { gain: 0.03, hzMin: 1800, hzMax: 3200, q: 0.7, alphaRef: 0.7, speedRef: 1, smoothS: 1.2 },
  // Weather push quantum (WP26): gameAudio sends a new wind / rain level to the synth only when it moved by this much (gain) or this many Hz.
  weatherStep: { gain: 0.0005, hz: 50 },

  // Mains hum (Era II): 50 Hz fundamental plus a 100 Hz harmonic; gain rises with EE/s on a log curve.
  // maxPerSecond is at least 3x the PF rate of EE (WP15R D2).
  mains: { hz: 50, harmonicHz: 100, harmonicGain: 0.5, minGain: 0.025, maxGain: 0.09, refPerSecond: 1, maxPerSecond: 3000000 },

  // Arc crackle (Era II, needs the spark gap): arcs/s rise with EE/s, capped at maxRate.
  // maxPerSecond is at least 3x the PF rate of EE (WP15R D2).
  arc: { minRate: 0.7, maxRate: 3, refPerSecond: 1, maxPerSecond: 3000000, ms: 40, gain: 0.25, highpassHz: 1800, techId: 'sparkGap' },

  // Relay click on a purchase paid with EE (purchaseCueByEra): two short square clicks.
  relay: { hz: 1200, ms: 18, gapMs: 55, gain: 0.35 },

  // Boiler roar (Era III): lowpassed noise bed; gain rises with PR/s on a log curve up to maxPerSecond. Owned boiler only.
  // maxPerSecond is at least 3x the PF rate of PR (WP15R D2).
  boiler: { lowpassHz: 160, minGain: 0.03, maxGain: 0.14, refPerSecond: 1, maxPerSecond: 3500000, techId: 'boiler' },

  // Steam hiss on a purchase paid with PR (purchaseCueByEra): one highpassed noise burst.
  hiss: { ms: 260, gain: 0.3, highpassHz: 2600 },

  // Milestone whistle: two sines together, attack then decay. Starts after the sting; techId is the milestone that triggers it.
  whistle: { hzA: 880, hzB: 1175, ms: 1100, attackMs: 90, gain: 0.2, techId: 'pressureVesselBlueprint' },

  // Resonance pad (Era IV): harmonic sines on baseHz with a slow LFO on the gain; gain rises with RS/s. Owned spire only.
  // maxPerSecond is at least 3x the PF rate of RS (WP15R D2).
  pad: {
    baseHz: 110,
    partials: [1, 2, 3],
    partialGains: [1, 0.5, 0.33],
    lfoHz: 0.15,
    lfoDepth: 0.35,
    minGain: 0.02,
    maxGain: 0.08,
    refPerSecond: 1,
    maxPerSecond: 1200000,
    techId: 'resonatorSpire',
  },

  // Fork ping (Era IV): two sines, a decaying ring on each manual click (echoCrank owned) and on every purchase paid with RS (purchaseCueByEra).
  forkPing: { hz: 512, partialRatio: 2.76, partialGain: 0.3, ms: 550, gain: 0.25, techId: 'echoCrank' },

  // Servo whirr (Era IV): sawtooth lowpassed, pitch and gain rise with the crank servo level (level / maxLevel).
  servo: { lowpassHz: 700, minHz: 55, maxHz: 110, minGain: 0.02, maxGain: 0.07, techId: 'crankServo' },

  // Milestone chord (Era IV): three sines at baseHz * ratios, after the sting; techId is the milestone that triggers it.
  chord: { baseHz: 110, ratios: [3, 4, 5], ms: 1200, attackMs: 250, gain: 0.18, techId: 'harmonicConvergence' },

  // Sub-bass drone (Era V): two sines (hz and hz * partialRatio) with a slow LFO on the gain; gain rises with XF/s. Owned nullChamber only.
  // maxPerSecond is at least 3x the PF rate of XF (WP15R D2).
  drone: { hz: 41, partialRatio: 2, partialGain: 0.3, lfoHz: 0.07, lfoDepth: 0.35, minGain: 0.02, maxGain: 0.09, refPerSecond: 1, maxPerSecond: 800000, techId: 'nullChamber' },

  // Reversed swell (purchase paid with XF via purchaseCueByEra, and the finale swell beat): filtered noise with a rising lowpass plus a sawtooth, one gain that rises over ms then stops hard.
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

  // Machine Fault spawn cue (WP27): one cue per spawn, shaped by the era (flavourByEra[era - 1]). Every flavour ends inside 400 ms at gain
  // 0.25 or less; no cue on expire. crackle (eras I-II, spark gap), hiss (era III, steam) and static (era V, soft static) are noise: `count`
  // pulses of pulseMs, gapMs apart, through one filter (type at hz, Q q). ping (era IV, fork): sines at hz and hz x detuneRatio (the second
  // at partialGain), ringing over ms. The summed peak of the two sines is gain x (1 + partialGain): 0.25 or less.
  faultSpawn: {
    ms: 260,
    gain: 0.2,
    flavourByEra: ['crackle', 'crackle', 'hiss', 'ping', 'static'] satisfies readonly [FaultFlavour, FaultFlavour, FaultFlavour, FaultFlavour, FaultFlavour],
    crackle: { count: 3, gapMs: 70, pulseMs: 30, type: 'highpass', hz: 1800, q: 0.7 },
    hiss: { count: 1, gapMs: 0, pulseMs: 260, type: 'highpass', hz: 2600, q: 0.7 },
    static: { count: 1, gapMs: 0, pulseMs: 260, type: 'lowpass', hz: 2400, q: 0.7 },
    ping: { hz: 1100, detuneRatio: 1.03, partialGain: 0.25 },
  },
  // Machine Fault clear cue (WP27): a ratchet clunk (`count` bandpassed noise ticks, Q q, gapMs apart), a bright sine tick at bright.atMs and,
  // with Overdrive, a second tick that rises from overdrive.fromHz to toHz at overdrive.atMs. The whole cue ends inside 300 ms; gain 0.35 cap.
  faultClear: {
    ratchet: { count: 2, gapMs: 40, pulseMs: 35, type: 'bandpass', hz: 900, q: 3, gain: 0.3 },
    bright: { hz: 2600, atMs: 100, ms: 30, gain: 0.25 },
    overdrive: { fromHz: 1800, toHz: 3600, atMs: 150, ms: 60, gain: 0.2 },
  },

  // Cue sounds (WP28): parts are [source, hz, atMs, ms, gain, fromHz?] (CuePart); the synth plays each part at its atMs.
  // cueQ is the Q of every noise part. Gains stay at 0.3 or less; the per-cue end and gain limits are tested in audioMath.test.ts.
  cueQ: 1.5,
  // Find spawn chime: two soft sines, the second 110 ms after the first. Ends inside 300 ms; gain 0.2 cap.
  findSpawn: [['sine', 1319, 0, 180, 0.16], ['sine', 1760, 110, 180, 0.16]],
  // Find pickup clink: a sine and a quieter partial (2.76 x). Ends inside 200 ms; gain 0.3 cap.
  findCollect: [['sine', 2100, 0, 160, 0.25], ['sine', 5796, 0, 160, 0.1]],
  // Relic pickup: a paper rustle, one filtered noise burst. Ends inside 300 ms; gain 0.25 cap.
  relicCollect: [['highpass', 3000, 0, 260, 0.2]],
  // Splice wake by era (index era - 1): I ratchet and bell, II hum swell and click, III valve hiss, IV soft ring, V low swell.
  // The swells have no attack in this format: a glide up from fromHz stands in for the rise. Each ends inside 600 ms; gain 0.3 cap.
  spliceWake: [
    [['bandpass', 1100, 0, 25, 0.25], ['bandpass', 1100, 60, 25, 0.25], ['bandpass', 1100, 120, 25, 0.25], ['sine', 1560, 180, 380, 0.2]],
    [['sine', 110, 0, 500, 0.2, 90], ['sine', 220, 0, 500, 0.2, 200], ['square', 1800, 480, 15, 0.2]],
    [['highpass', 2600, 0, 420, 0.2]],
    [['sine', 660, 0, 540, 0.2], ['sine', 990, 0, 540, 0.2]],
    [['sawtooth', 55, 0, 560, 0.25, 40], ['sine', 82.5, 0, 560, 0.2, 60]],
  ],

  // Poke cues (WP28): two variants per id, one cue part each (atMs 0). gameAudio picks a variant (not one of the last avoidRecent picks
  // while another is free) and a pitch of 1 +- pitchSpread. Every variant ends inside 400 ms at gain 0.3 or less.
  poke: {
    pitchSpread: 0.05,
    avoidRecent: 2,
    variants: {
      tick: [['bandpass', 2200, 0, 25, 0.2], ['square', 1800, 0, 15, 0.12]],
      pencil: [['highpass', 3000, 0, 60, 0.15], ['bandpass', 4000, 0, 40, 0.15]],
      woof: [['square', 110, 0, 180, 0.25, 150], ['triangle', 90, 0, 220, 0.25, 120]],
      caw: [['sawtooth', 520, 0, 260, 0.2, 420], ['sawtooth', 300, 0, 300, 0.2, 380]],
      beep: [['square', 880, 0, 120, 0.15], ['sine', 1040, 0, 90, 0.2]],
      ring: [['sine', 480, 0, 350, 0.2], ['sine', 520, 0, 300, 0.2]],
      tink: [['sine', 2600, 0, 150, 0.2], ['sine', 3100, 0, 120, 0.2]],
      note: [['triangle', 523, 0, 300, 0.25], ['triangle', 659, 0, 280, 0.25]],
      organ: [['sine', 330, 0, 380, 0.2], ['sine', 262, 0, 380, 0.2]],
      bell: [['sine', 740, 0, 380, 0.25], ['sine', 880, 0, 340, 0.25]],
      crackle: [['highpass', 1800, 0, 200, 0.2], ['bandpass', 900, 0, 150, 0.2]],
      buzz: [['sawtooth', 90, 0, 180, 0.2], ['square', 110, 0, 140, 0.15]],
    } satisfies Record<PokeSoundId, readonly [CuePart, CuePart]>,
  },

  // Ambient bed trims per era I..V (WP15 D8): older beds recede as later eras arrive. 1 = no change (before the bed exists it is 1).
  bedTrim: {
    hum: [1, 0.85, 0.65, 0.4, 0.3],
    gear: [1, 0.85, 0.65, 0.4, 0.3],
    mains: [1, 1, 0.8, 0.5, 0.4],
    // Era III re-trim for the rain bed so ambientPeakSum(3) stays <= 0.45; the bible says the front builds, so the boiler gives way, not the wind.
    boiler: [1, 1, 0.8, 0.6, 0.5],
    pad: [1, 1, 1, 1, 0.7],
    servo: [1, 1, 1, 1, 0.7],
    drone: [1, 1, 1, 1, 1],
    wind: [1, 1, 1, 1, 1],
    // Silent from era IV: the virga is frozen in IV and gone in V.
    rain: [1, 1, 1, 0, 0],
  } satisfies Record<BedId, readonly [number, number, number, number, number]>,

  // Master limiter (WP15 mix): catches peaks after the master gain. Attack and release in seconds.
  limiter: { threshold: -10, knee: 6, ratio: 4, attack: 0.005, release: 0.25 },

  // World voices (WP23a): one blip voice per speaker on the sfx bus. `count` blips sit gapMs apart; each is ms long.
  // dog: tape-wobble LFO (wobbleHz, wobbleCents on pitch). crow: FM rasp (fmHz, fmDepth). payphone: bandpass at bandpassHz.
  // maxConcurrent blip sequences may sound at once; the rest are refused (gameAudio).
  world: {
    maxConcurrent: 2,
    // Most blips one line plays (DENIZEN_ART §4.3: min(words, 8)). The synth clamps a blip sequence to it; blipCount in worldTurn.ts caps a line by it.
    maxBlips: 8,
    blip: {
      inspector: { wave: 'square', hz: 150, ms: 55, gapMs: 70, gain: 0.07 },
      dog: { wave: 'square', hz: 150, ms: 60, gapMs: 70, gain: 0.07, wobbleHz: 6, wobbleCents: 40 },
      crow: { wave: 'sawtooth', hz: 420, ms: 50, gapMs: 65, gain: 0.05, fmHz: 90, fmDepth: 120 },
      girl: { wave: 'sine', hz: 760, ms: 70, gapMs: 80, gain: 0.07 },
      payphone: { wave: 'square', hz: 520, ms: 45, gapMs: 60, gain: 0.05, bandpassHz: 1400 },
    },
    // Payphone ring: two sines (hzA, hzB) in `bursts` bursts of burstMs, gapMs apart.
    ring: { hzA: 440, hzB: 480, bursts: 2, burstMs: 400, gapMs: 200, gain: 0.08 },
    // Dial tone: two sines (hzA, hzB), faded in and out over fadeMs; stops by itself after maxMs.
    dialTone: { hzA: 350, hzB: 440, maxMs: 2000, gain: 0.04, fadeMs: 80 },
  },
} as const;
