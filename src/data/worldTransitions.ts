// Living world transition data (WP24): durations, stagger gaps and the start priority of every change that used to land instantly.
// Why: nothing in the living world changes in one frame. The queue (src/game/math/worldTransitions.ts) runs these numbers as written and holds no literal of its own.
// Pure data: no Phaser. Each row names the D-T change it times (docs/plan/WP24.md). `order` ranks queued rows: earlier starts first when several are due.
// Toggle gaps (`toggleMs` 340) keep a stutter at or under 3 on-to-off toggles a second, so a flicker never reads as a strobe.

export type TransitionId = 'eraRow' | 'alpha' | 'shadowScale' | 'shadows' | 'drawFps' | 'led' | 'lamp' | 'booth' | 'lampWarm' | 'lampDead'
  | 'windows' | 'breathe' | 'windowsDark' | 'girlWindow' | 'motes' | 'motesFreeze' | 'motesFall' | 'hole' | 'scrapBurn' | 'puddle'
  | 'puddleBlack' | 'sprout' | 'fogBuild' | 'fogClear' | 'chladni' | 'chladniViolet' | 'virga' | 'receiver' | 'stare' | 'reverse' | 'unison';

export const WORLD_TRANSITIONS = {
  // A queued row starts this long after the last gate closes (TECH INDEX, era card, modal); starts of one batch sit staggerMs apart.
  startAfterCloseMs: 1000,
  staggerMs: [600, 1200],
  order: ['eraRow', 'alpha', 'shadowScale', 'shadows', 'drawFps', 'led', 'lamp', 'booth', 'lampWarm', 'lampDead', 'windows', 'breathe',
    'windowsDark', 'girlWindow', 'motes', 'motesFreeze', 'motesFall', 'hole', 'scrapBurn', 'puddle', 'puddleBlack', 'sprout', 'fogBuild',
    'fogClear', 'chladni', 'chladniViolet', 'virga', 'receiver', 'stare', 'reverse', 'unison'] as const satisfies readonly TransitionId[],
  rows: {
    // Era row crossfade (keystone: cast, booth, receiver, Sensor 7); cast alpha and shadow scale ramp; drawn fps ramps through the steps.
    eraRow: { ms: 8000 }, alpha: { ms: 4000 }, shadowScale: { ms: 4000 }, shadows: { ms: 10000 }, drawFps: { ms: 3000 }, led: { ms: 3000 },
    // Street lamp: buzz-on stutter, then the glow fades in. Booth hood light stutters on after the lamp.
    lamp: { buzzMs: 3000, toggleMs: 340, glowMs: 4000 },
    booth: { delayAfterLampMs: 1500, totalMs: 2500, toggleMs: 340 },
    lampWarm: { ms: 20000 }, lampDead: { ms: 2000, toggleMs: 340 },
    // Six far windows, one by one: 300 ms flicker-on each. Gaps of 3-6 s: five gaps of 3 s already reach the 15 s minimum.
    windows: { flickerMs: 300, gapMs: [3000, 6000], totalMinMs: 15000 },
    breathe: { ms: 4000 },
    // Era V windows go dark one by one: two flickers, then a fade, 3 s apart.
    windowsDark: { flickers: 2, flickerMs: 150, fadeMs: 1500, gapMs: 3000 },
    // The girl window flicker slows as the window goes dark: each flicker hold stretches by 1 + slowK x slowFactor.
    girlWindow: { ms: 4000, slowFactor: 3 },
    // Motes appear one at a time, 4-8 s apart; five gaps at the lower bound reach the 20 s minimum.
    motes: { gapMs: [4000, 8000], fadeMs: 1000, totalMinMs: 20000 },
    motesFreeze: { ms: 3000 }, motesFall: { ms: [20000, 40000] },
    // Hole stage: one step per dig bout (bout >= boutMinMs); later eras settle over settleMs.
    hole: { boutMinMs: 6000, settleMs: 30000 },
    scrapBurn: { ms: 4000, gapMs: 2000 },
    puddle: { ms: 45000 }, puddleBlack: { ms: 20000 }, sprout: { ms: 40000 },
    // Booth fog and Sensor 7 lens fog: build at the first vent puff, clear after the era IV entry.
    fogBuild: { ms: 30000 }, fogClear: { ms: 30000 },
    // Chladni rings light ring by ring; violet is a colour crossfade.
    chladni: { ringMs: 1500, gapMs: 1500 }, chladniViolet: { ms: 10000 },
    virga: { inMs: 20000, freezeMs: 10000, outMs: 60000 },
    receiver: { ms: 3000 },
    // Stare: each actor turns to the camera at offset x spreadMs (offsets are fractions of the spread, ascending by actor).
    stare: { spreadMs: 3000, offsets: { inspector: 0.25, dog: 0.5, crow: 0.75, girl: 1 } },
    // Reverse finishes each walk first (no timed ramp); unison joins each runner within maxBeats of the downbeat.
    reverse: { ms: 0 }, unison: { maxBeats: 3 },
  } as const satisfies Record<TransitionId, object>,
} as const;
