// Living world finale, postgame and KEEP numbers (WP23b): home feet, film frames, crow flight, KEEP beats, the 90 s postgame loop
// and the Sensor 7 camera turn. Why: the film and postgame code read one copy of each number and sheet frame name.
// Pure data: no Phaser. Film times are seconds of the finale clock (finale.ts); postgame segments are seconds of the 90 s loop.
// KEEP walks: the dog never crosses the machine. It fades out at its home in the right gap and re-enters from the left wing (the
// anchor boxes at portrait are x 848-912 and 2928-2992). Walk speeds come from the sprite strides (dogStride, strideWorldPx).
// Derived values (restore times per denizen, LAST LOOK, the choice time) are computed in src/game/math/worldFinale.ts, not stored here.

// Feet x per denizen in the finale, postgame and survey views (world px; DENIZEN_ART §3, s15 / postgame column).
export const WORLD_ENDING = {
  homeX: {
    inspector: 784, dog: 2856, crow: 3104, girl: 976, sensor7: 712, payphone: 3050, lamp: 3104, clock: 2890, sprout: 996,
    puddles: 960, stake: 2840, hole: 2886, lantern: 965,   // the girl's x minus 11 (AD3b; supersedes DENIZEN_ART 990)
  },
  postgameDogHomeX: 732,   // left wing, front row (DENIZEN_ART §3 fix 6): the dog sleeps and chases here, not at 2856
  // Shield frame at the 13 s beam, and the stare frame each denizen turns to camera on (LAST LOOK, KEEP).
  shieldFrames: { inspector: 'shield', dog: 'flat', girl: 'shield', crow: 'perch1' },
  stareFrames: { inspector: 'front', dog: 'head', crow: 'head', girl: 'stand0', sensor7: 'headC' },
  crossfadeMs: 400,
  // The girl runs off left, her back to us, while the skyline fades in. The lantern drops during the lanternDrop pose, then lies.
  girlRun: { startS: 31.5, endS: 34, dxWorldPx: -420, frames: ['run0', 'run1', 'run2', 'run3'], fps: 8, dropFrame: 'lanternDrop', dropMs: 200 },
  inspectorBaseL: { fromS: 41, toS: 43, frame: 'idleB' },
  dogWag: { fromS: 45.2, toS: 45.8, frame: 'wag' },
  // Crow: takes off at 37 s and leads the first flock (fx.bird pool, 38 s); glides back to the lamp from 47.5 s to 49.3 s.
  crow: {
    takeoffS: 37, returnFromS: 47.5, returnToS: 49.3, flyFrames: ['fly0', 'fly1', 'fly2'], fps: 8,
    climbDx: 300, climbDy: -380, returnStartDx: 520, returnStartDy: -380,
  },
  lastLookBlinkMs: 250,
  // KEEP IT RUNNING beats, seconds after KEEP: turn away, the crow's three pecks at mark 42, the dog fades out at its home in the
  // right gap (4-4.5 s; the crow beat holds the eye meanwhile), hidden 4.5-7 s, re-entry from the left wing (7-8 s, from x 540),
  // sat at its left wing home from 8 s; dogSettleS / loopStartS (9 s) hand over to the postgame loop.
  keep: {
    turnAwayS: 1.5, scratchStartS: 3, hopMs: 200, pecks: 3, peckMs: 300, hopDx: -54, hopDy: 10,
    dogFade: { fromS: 4, toS: 4.5 }, dogEnter: { fromS: 7, toS: 8, fromX: 540 }, dogSettleS: 9, loopStartS: 9,
  },
  // Walk speeds in world px a frame. KEEP re-entry: 16 px at 12 fps (192 px/s). Postgame: a moving segment lasts
  // max(|dx|, |dy|) / (stride * segment fps) s; the Inspector walk moves 8 px a frame, the dog chase frames 16.
  dogStride: { worldPxPerFrame: 16, fps: 12 },
  strideWorldPx: { inspector: 8, dogChase: 16 },
  // Sensor 7 turns to camera once, after 20 min of postgame, and holds 3 s (its second and last camera beat).
  sensorTurn: { afterPostgameS: 1200, holdS: 3 },
} as const;

// One postgame loop segment: frames cycle at fps; dx and dy (world px, +down) are linear from dxFrom / dyFrom to dxTo / dyTo over the
// segment; flip true = faces left. A moving segment walks at its stride (strideWorldPx): it lasts max(|dx|, |dy|) / (stride * fps) s.
export interface PostgameSegment { fromS: number; toS: number; frames: readonly string[]; fps: number; dxFrom: number; dxTo: number; dyFrom: number; dyTo: number; flip: boolean; name: string }

// The 90 s postgame loop (bible §9.2). Each list covers [0, periodS) with no gaps. The Inspector's pat (the scripted INS-PG line)
// is at patAtS; the dog's loop starts at KEEP + 9 s. Denizen and prop loops only: flocks and seeds keep their own schedules.
// The Inspector walks to the front row (dy 32) and pats the dog at x 742 (784 - 42); the dog stands at 732 (DENIZEN_ART §3 fix 6).
// Sits keep the facing of the dash they follow; the dog's dashes are chase frames at 6 fps.
export const WORLD_POSTGAME_LOOP: {
  periodS: number; patAtS: number; inspector: readonly PostgameSegment[]; dog: readonly PostgameSegment[]; crow: readonly PostgameSegment[];
} = {
  periodS: 90,
  patAtS: 14.5,
  inspector: [
    { fromS: 0, toS: 13.34375, frames: ['idleA', 'idleB'], fps: 2, dxFrom: 0, dxTo: 0, dyFrom: 0, dyTo: 0, flip: true, name: 'rest' },
    { fromS: 13.34375, toS: 14, frames: ['walk0', 'walk1', 'walk2', 'walk3'], fps: 8, dxFrom: 0, dxTo: -42, dyFrom: 0, dyTo: 32, flip: true, name: 'cross' },
    { fromS: 14, toS: 20, frames: ['pat0', 'pat1'], fps: 2, dxFrom: -42, dxTo: -42, dyFrom: 32, dyTo: 32, flip: true, name: 'pat' },
    { fromS: 20, toS: 24, frames: ['watch'], fps: 1, dxFrom: -42, dxTo: -42, dyFrom: 32, dyTo: 32, flip: true, name: 'watch' },
    { fromS: 24, toS: 30, frames: ['wave'], fps: 1, dxFrom: -42, dxTo: -42, dyFrom: 32, dyTo: 32, flip: true, name: 'wave' },
    { fromS: 30, toS: 30.65625, frames: ['walk0', 'walk1', 'walk2', 'walk3'], fps: 8, dxFrom: -42, dxTo: 0, dyFrom: 32, dyTo: 0, flip: false, name: 'return' },
    { fromS: 30.65625, toS: 45, frames: ['write0', 'write1'], fps: 4, dxFrom: 0, dxTo: 0, dyFrom: 0, dyTo: 0, flip: true, name: 'write' },
    { fromS: 45, toS: 90, frames: ['idleA', 'idleB'], fps: 2, dxFrom: 0, dxTo: 0, dyFrom: 0, dyTo: 0, flip: true, name: 'rest2' },
  ],
  dog: [
    { fromS: 0, toS: 12, frames: ['sleep'], fps: 1, dxFrom: 0, dxTo: 0, dyFrom: 0, dyTo: 0, flip: false, name: 'sleep' },
    { fromS: 12, toS: 14, frames: ['sit0'], fps: 1, dxFrom: 0, dxTo: 0, dyFrom: 0, dyTo: 0, flip: false, name: 'wake' },
    { fromS: 14, toS: 20, frames: ['sit0', 'wag'], fps: 2, dxFrom: 0, dxTo: 0, dyFrom: 0, dyTo: 0, flip: false, name: 'patted' },
    { fromS: 20, toS: 30, frames: ['sit0', 'sit1'], fps: 2, dxFrom: 0, dxTo: 0, dyFrom: 0, dyTo: 0, flip: false, name: 'calm' },
    { fromS: 30, toS: 30.375, frames: ['chase0', 'chase1'], fps: 6, dxFrom: 0, dxTo: 36, dyFrom: 0, dyTo: 0, flip: false, name: 'dash1' },
    { fromS: 30.375, toS: 38, frames: ['sit0', 'sit1'], fps: 2, dxFrom: 36, dxTo: 36, dyFrom: 0, dyTo: 0, flip: false, name: 'hold1' },
    { fromS: 38, toS: 38.375, frames: ['chase0', 'chase1'], fps: 6, dxFrom: 36, dxTo: 0, dyFrom: 0, dyTo: 0, flip: true, name: 'dash2' },
    { fromS: 38.375, toS: 48, frames: ['sit0', 'sit1'], fps: 2, dxFrom: 0, dxTo: 0, dyFrom: 0, dyTo: 0, flip: true, name: 'hold2' },
    { fromS: 48, toS: 48.375, frames: ['chase0', 'chase1'], fps: 6, dxFrom: 0, dxTo: 36, dyFrom: 0, dyTo: 0, flip: false, name: 'dash3' },
    { fromS: 48.375, toS: 58, frames: ['sit0', 'sit1'], fps: 2, dxFrom: 36, dxTo: 36, dyFrom: 0, dyTo: 0, flip: false, name: 'hold3' },
    { fromS: 58, toS: 58.375, frames: ['chase0', 'chase1'], fps: 6, dxFrom: 36, dxTo: 0, dyFrom: 0, dyTo: 0, flip: true, name: 'dash4' },
    { fromS: 58.375, toS: 66, frames: ['sit0', 'sit1'], fps: 2, dxFrom: 0, dxTo: 0, dyFrom: 0, dyTo: 0, flip: true, name: 'hold4' },
    { fromS: 66, toS: 72, frames: ['sit0', 'sit1'], fps: 2, dxFrom: 0, dxTo: 0, dyFrom: 0, dyTo: 0, flip: true, name: 'calm2' },
    { fromS: 72, toS: 90, frames: ['sleep'], fps: 1, dxFrom: 0, dxTo: 0, dyFrom: 0, dyTo: 0, flip: false, name: 'sleep2' },
  ],
  crow: [
    { fromS: 0, toS: 90, frames: ['perch0', 'perch1'], fps: 0.5, dxFrom: 0, dxTo: 0, dyFrom: 0, dyTo: 0, flip: false, name: 'perch' },
  ],
};
