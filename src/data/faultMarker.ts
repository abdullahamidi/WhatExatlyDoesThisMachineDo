import type { MachineComponentId } from './machineComponents';

// WP27 Machine Faults, marker data: the art map of the fault marker, its layout and its player-facing texts. Own module, so
// Vite bundles them in the lazy FaultMarker chunk. Import it ONLY from src/game/math/faultMarker.ts,
// src/game/rendering/FaultMarker.ts and tests. The clock numbers stay in ./faults.

export const FAULT_MARKER = {
  // A fault sits on anchors[era][serial % 2] when that part is on screen, else on the other anchor of the era, else fallbackAnchor.
  // The picks are the ADb hand-off (docs/plan/ART_AUDIT.md, WP27-FAULT-HANDOFF): parts that stand in each era's frame.
  // Era V: graviticAnchorR (AD2 F3: graviticAnchorL's top sits under the UI-150 HUD) and the generator (AD2 round 2 F8: before
  // Gravitic Anchor the crank fallback put the marker's hit zone into the crank hit circle; the generator stands in every era V framing).
  anchors: { 1: ['pistonArray', 'flywheel'], 2: ['sparkGap', 'flywheel'], 3: ['boiler', 'steamHammer'],
    4: ['spireExciter', 'calliope'], 5: ['graviticAnchorR', 'generator'] } satisfies Record<1 | 2 | 3 | 4 | 5, readonly MachineComponentId[]>,
  fallbackAnchor: 'handCrank' satisfies MachineComponentId,
  // Sheet 'fx.fault': frames tag (2), fx per era (2 each), clear (1). frameMs 340 = 2.9 Hz flicker; never faster than 3 Hz.
  art: { sheet: 'fx.fault', tag: [0, 1], fx: { 1: [2, 3], 2: [2, 3], 3: [4, 5], 4: [6, 7], 5: [8, 9] }, clear: 10, frameMs: 340 },
  // Marker layout in art px (scaled by the zoom) and timings in ms. The hit zone is at least hitMinScreenPx on screen.
  // offsetArtPx y -10 (AD2 F4): the era III plate clears the UI-150 HUD by 6-11 px (-14 left only 1-4 px).
  // gapArtPx: space under the plate, between the plate and the timer bar, and between the bar and the label.
  // anchorInsetWorldPx: an anchor counts as on screen only this far inside the camera view (world px), so the marker never
  // sits on the frame edge. barColor: the timer bar (the crank pulse amber). label: the two-line code text under the bar;
  // its font never drops below minScreenPx on screen (as the crank gain text).
  layout: { offsetArtPx: { x: 0, y: -10 }, hitMinScreenPx: 56, barArtPx: { w: 16, h: 2 }, gapArtPx: 2, fadeMs: 300, clearFrameMs: 250,
    anchorInsetWorldPx: 80, barColor: 0xffd27a,
    label: { fontPx: 14, minScreenPx: 12, strokePx: 3, color: '#ffd27a', strokeColor: '#14110f' } },
} as const;

// Player-facing fault text, in the machine's dry voice. {code}, {s} and {f} are filled by the caller.
export const FAULT_TEXT = {
  tag: 'FAULT', key: '[F]',
  codes: { 1: ['BELT SLIP', 'BEARING DRY', 'SHAFT KNOCK'], 2: ['ARC LEAK', 'COIL CHATTER', 'BRUSH SPARK'],
    3: ['SEAL HISS', 'VALVE STICK', 'GAUGE FLUTTER'], 4: ['PHASE DRIFT', 'FORK DETUNE', 'NODE SLIP'],
    5: ['NULL BLEED', 'RING SKEW', 'UNITS UNKNOWN'] },
  announceSpawn: 'Fault: {code}. Click it or press F to clear.', announceClear: 'Fault cleared.', a11yPrefix: 'MACHINE',
  popupHeader: 'CLEARED +{s}s', overdrive: 'OVERDRIVE ×{f} · {s}s',
} as const;
