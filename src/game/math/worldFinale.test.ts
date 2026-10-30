// Tests for worldFinale (WP23b): restore times (the wipe formula, 21.3 s + 2 s lag, 120 px a second), LAST LOOK (59.83 s) and the choice
// (62.6 s), the shield window (13-19.3 s), the girl's run (31.5-34 s), the crow's flight (37 / 38 / 47.5 / 49.3 s) from its lamp-arm
// rest crowRest (AD4 F45) and its reduced variant,
// the reduced whole state at 24.3 s, the LAST LOOK poses, the KEEP beats (1.5 s turn away, 3.0 s crow beat, the dog's fade at home and
// re-entry), the postgame loop, props (the second hand continuous from the choice) and worldRow, every pose on its sheet (frame, row 0..5), the dog clear of the anchor boxes on every
// KEEP and loop position, and a purity check (no Phaser, no DOM).
// Pure maths, no Phaser.
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { lastLookS, restoreTimeOf, worldFinaleFrame } from './worldFinale';
import type { WorldFinaleInput } from './worldFinale';
import { choiceStartS } from './finale';
import type { CastScriptPose, ScriptCastId, WorldScriptFrame } from './worldScript';
import { FINALE_VIEWS } from '../../data/finale';
import { MACHINE_ANCHOR, PIXEL_SCALE, VIEW } from '../../data/world';
import { WORLD_ENDING } from '../../data/worldEnding';
import { SPLICE_WORLD } from '../../data/spliceWorld';
import { WORLD_ERA_ENV } from '../../data/worldEras';
import { WORLD_FRAMES } from '../../data/livingWorld';
import type { WorldSheetId } from '../../data/livingWorld';

const BASE: WorldFinaleInput = { phase: 'sequence', t: 0, reduced: false, keepS: -1, loopS: 0, sensorTurn: false, lastFrame: false, cycle: 1 };
const frame = (over: Partial<WorldFinaleInput>): WorldScriptFrame => worldFinaleFrame({ ...BASE, ...over });
const film = (t: number, reduced = false): WorldScriptFrame => frame({ t, reduced });
const keep = (keepS: number, over: Partial<WorldFinaleInput> = {}): WorldScriptFrame => frame({ phase: 'postgame', keepS, ...over });
const HOME = WORLD_ENDING.homeX;
const IDS: ScriptCastId[] = ['inspector', 'dog', 'crow', 'girl', 'sensor7'];
const SHEET: Record<ScriptCastId, WorldSheetId> = { inspector: 'inspector', dog: 'dog', crow: 'crow', girl: 'girl', sensor7: 'sensor7' };
const absX = (f: WorldScriptFrame, id: ScriptCastId): number => HOME[id] + f.cast[id].dx;
const wrapDeg = (deg: number): number => ((deg % 360) + 360) % 360;
const angleDelta = (a: number, b: number): number => ((b - a + 540) % 360) - 180;   // the shortest signed turn from a to b degrees
const handOf = (f: WorldScriptFrame): number => f.props.secondHandDeg ?? Number.NaN;   // NaN fails every comparison below

// Portrait view (zoom 0.5 on the full view) and the machine box (DENIZEN_ART §3 s15: machine x 848-2992; 24 px margin as in R2.7).
const VIEW_HALF = VIEW.width / (2 * FINALE_VIEWS.full.zoom);
const VIEW_LEFT = MACHINE_ANCHOR.x - VIEW_HALF;
const DOG_HALF_W = (28 / 2) * PIXEL_SCALE;   // the dog sheet is 28 art px wide (DENIZEN_ART §5.1)
const BOX_LEFT = 848 - 24;
const BOX_RIGHT = 2992 + 24;
const ANCHOR_BOXES: [number, number][] = [[848, 912], [2928, 2992]];   // the machine's two anchor boxes at portrait

// Grid of film times in exact eighths of a second (no float drift at the boundaries).
const GRID: number[] = Array.from({ length: 561 }, (_, i) => i / 8);

describe('restore times', () => {
  it('restores at the wipe front: 21.3 s + 2 s lag + distance / 120 px a second', () => {
    expect(restoreTimeOf(784)).toBeCloseTo(21.3 + 2 + 1136 / 120, 9);
    expect(restoreTimeOf(1920)).toBeCloseTo(23.3, 9);
    expect(restoreTimeOf(2040)).toBeCloseTo(24.3, 9);
  });

  it('gives the denizen restores 32.77 / 31.1 / 33.17 / 31.17 / 33.37 s', () => {
    expect(restoreTimeOf(HOME.inspector)).toBeCloseTo(32.77, 2);
    expect(restoreTimeOf(HOME.dog)).toBeCloseTo(31.1, 2);
    expect(restoreTimeOf(HOME.crow)).toBeCloseTo(33.17, 2);
    expect(restoreTimeOf(HOME.girl)).toBeCloseTo(31.17, 2);
    expect(restoreTimeOf(HOME.sensor7)).toBeCloseTo(33.37, 2);
  });

  it('restores the chain with the dog, the booth at the payphone, the clock, the lamp, the sprout, the puddles and the hole', () => {
    expect(film(31.0).props.chain).toBe('stage');
    expect(film(31.2).props.chain).toBe('fallen');
    expect(film(32.6).props.booth).toBe('dark');
    expect(film(32.8).props.booth).toBe('restored');
    expect(film(31.3).props.clock).toBe('ruin');
    expect(film(31.5).props.clock).toBe('restored');
    expect(film(33.1).props.lamp).toBe('stage');
    expect(film(33.3).props.lamp).toBe('restored');
    expect(film(30.9).props.sprout).toBe('stage');
    expect(film(31.1).props.sprout).toBe('bloom');
    expect(film(31.2).props.puddles).toBe('stage');
    expect(film(31.4).props.puddles).toBe('whole');
    expect(film(31.3).props.hole).toBe('stage');
    expect(film(31.4).props.hole).toBe('hidden');
  });
});

describe('LAST LOOK and the choice', () => {
  it('lands LAST LOOK at 59.83 s and opens the choice at 62.6 s', () => {
    expect(lastLookS()).toBeCloseTo(59.83, 2);
    expect(choiceStartS()).toBeCloseTo(62.6, 2);
    expect(lastLookS()).toBeLessThan(choiceStartS());
  });
});

describe('shield window and stare poses', () => {
  it('stares at camera before the 13 s beam (row 4, no shadow)', () => {
    const f = film(12.9);
    expect(f.cast.inspector.frame).toBe('front');
    expect(f.cast.dog.frame).toBe('head');
    expect(f.cast.crow.frame).toBe('head');
    expect(f.cast.girl.frame).toBe('stand0');
    expect(f.cast.sensor7.frame).toBe('headC');
    for (const id of IDS) {
      expect(f.cast[id].row, id).toBe(4);
      expect(f.cast[id].shadow, id).toBe(false);
    }
  });

  it('shields from 13 s to 19.3 s (sensor 7 keeps its head)', () => {
    for (const t of [13, 19.2]) {
      const f = film(t);
      expect(f.cast.inspector.frame, `t ${t}`).toBe('shield');
      expect(f.cast.dog.frame).toBe('flat');
      expect(f.cast.girl.frame).toBe('shield');
      expect(f.cast.crow.frame).toBe('perch1');
      expect(f.cast.sensor7.frame).toBe('headC');
    }
  });

  it('stares again from 19.3 s, still on era V', () => {
    const f = film(19.3);
    expect(f.cast.inspector.frame).toBe('front');
    expect(f.cast.dog.frame).toBe('head');
    expect(f.cast.crow.frame).toBe('head');
    expect(f.cast.inspector.row).toBe(4);
  });

  it('darkens the booth and kills the LED from 13 s until the Sensor 7 restore', () => {
    expect(film(12.9).props.booth).toBe('stage');
    expect(film(12.9).props.sensorLed).toBe('stage');
    expect(film(13).props.booth).toBe('dark');
    expect(film(13).props.sensorLed).toBe('dead');
    expect(film(33.3).props.sensorLed).toBe('dead');
    expect(film(33.3).cast.sensor7.frame).toBe('headC');
    expect(film(33.5).props.sensorLed).toBe('green');
    expect(film(33.5).cast.sensor7.frame).toBe('headUp');
  });
});

describe('restore crossfade and whole poses', () => {
  it('crossfades era V to the whole row over 400 ms from the inspector restore', () => {
    const r = restoreTimeOf(HOME.inspector);
    const before = film(r - 0.01).cast.inspector;
    expect(before.row).toBe(4);
    expect(before.blendRow).toBeNull();
    expect(before.shadow).toBe(false);
    const start = film(r).cast.inspector;
    expect(start.row).toBe(4);
    expect(start.blendRow).toBe(5);
    expect(start.blend).toBeCloseTo(0, 9);
    expect(start.shadow).toBe(true);
    expect(film(r + 0.2).cast.inspector.blend).toBeCloseTo(0.5, 6);
    const done = film(r + 0.41).cast.inspector;
    expect(done.row).toBe(5);
    expect(done.blendRow).toBeNull();
    expect(done.blend).toBe(0);
  });

  it('shows the whole poses after the restores: idle, sit, perch, head up', () => {
    const f = film(35);
    expect(f.cast.inspector.frame).toBe('idleA');
    expect(f.cast.inspector.flip).toBe(true);
    expect(f.cast.dog.frame).toBe('sit0');
    expect(f.cast.dog.flip).toBe(false);
    expect(f.cast.crow.frame).toBe('perch0');
    expect(f.cast.sensor7.frame).toBe('headUp');
    expect(f.cast.girl.visible).toBe(false);
  });

  it('idles B in the base-left survey (41-43 s) and wags for a moment (45.2-45.8 s)', () => {
    expect(film(41.5).cast.inspector.frame).toBe('idleB');
    expect(film(41.5).cast.inspector.flip).toBe(true);
    expect(film(43.01).cast.inspector.frame).toBe('idleA');
    expect(film(45.5).cast.dog.frame).toBe('wag');
    expect(film(46).cast.dog.frame).toBe('sit0');
  });
});

describe('girl run', () => {
  it('stands, then drops the lantern at 31.5 s, then runs left (no flip) until 34 s', () => {
    expect(film(31.4).cast.girl.frame).toBe('stand0');
    expect(film(31.4).props.lantern).toBe('none');
    const drop = film(31.5).cast.girl;
    expect(drop.visible).toBe(true);
    expect(drop.frame).toBe('lanternDrop');
    expect(drop.dx).toBe(0);
    expect(film(31.5).props.lantern).toBe('none');           // the lantern lands when the drop pose ends (31.7 s)
    expect(film(31.69).props.lantern).toBe('none');
    expect(film(31.7).props.lantern).toBe('fallen');
    expect(film(31.69).cast.girl.frame).toBe('lanternDrop');
    const run0 = film(31.75).cast.girl;
    expect(run0.frame).toBe('run0');
    expect(run0.dx).toBeCloseTo((-420 * 0.05) / (34 - 31.7), 6);
    expect(run0.flip).toBe(false);
    const run1 = film(31.9).cast.girl;
    expect(run1.frame).toBe('run1');
    expect(run1.dx).toBeCloseTo((-420 * (31.9 - 31.7)) / (34 - 31.7), 6);
    expect(film(33.99).cast.girl.visible).toBe(true);
    expect(film(33.99).cast.girl.dx).toBeLessThan(-418);
    expect(film(34).cast.girl.visible).toBe(false);
    expect(film(35).cast.girl.visible).toBe(false);
  });
});

describe('crow flight', () => {
  // AD4 F45: the crow starts from crowRest (30, 26), the kite's lamp-arm end, so every flight pose is re-pinned by that offset.
  it('takes off at 37 s from crowRest, climbs to the first flock at 38 s (dx 300, dy -380)', () => {
    const start = film(37).cast.crow;
    expect(start.visible).toBe(true);
    expect(start.frame).toBe('fly0');
    expect(start.dx).toBe(30);
    expect(start.dy).toBe(26);
    expect(film(37).lead).toBeNull();
    const mid = film(37.5).cast.crow;
    expect(mid.dx).toBeCloseTo(180, 6);     // 30 + 150
    expect(mid.dy).toBeCloseTo(-164, 6);    // 26 - 190
    const top = film(37.999).cast.crow;
    expect(top.visible).toBe(true);
    expect(top.dx).toBeGreaterThan(329);
    expect(top.dy).toBeLessThan(-353);
  });

  it('is out of view from 38 s to 47.5 s while the flock leads', () => {
    const at38 = film(38);
    expect(at38.cast.crow.visible).toBe(false);
    expect(at38.lead).toEqual({ frame: 'fly0', row: 5 });
    expect(film(40).cast.crow.visible).toBe(false);
    expect(film(40).lead?.frame).toBe('fly1');
    expect(film(47.49).cast.crow.visible).toBe(false);
    expect(film(47.49).lead).not.toBeNull();
  });

  it('glides back from crowRest + (520, -380) = (550, -354) to crowRest from 47.5 s to 49.3 s', () => {
    const start = film(47.5).cast.crow;
    expect(start.visible).toBe(true);
    expect(start.dx).toBe(550);
    expect(start.dy).toBe(-354);
    expect(film(47.5).lead).toBeNull();
    const mid = film(48.4).cast.crow;
    expect(mid.dx).toBeCloseTo(290, 6);     // 30 + 260
    expect(mid.dy).toBeCloseTo(-164, 6);    // 26 - 190
    const home = film(49.3).cast.crow;
    expect(home.visible).toBe(true);
    expect(home.frame).toBe('perch0');
    expect(home.dx).toBe(30);
    expect(home.dy).toBe(26);
  });

  it('hands the lead to the first bird only for non-reduced 38 to 47.5 s', () => {
    for (const t of GRID) {
      const want = t >= 38 && t < 47.5;
      expect(film(t).lead !== null, `t ${t}`).toBe(want);
      expect(film(t, true).lead, `reduced t ${t}`).toBeNull();
    }
  });
});

describe('reduced motion', () => {
  it('keeps the crow perched: no takeoff, no lead, out of view from 38 s to 49.3 s', () => {
    const before = film(37, true).cast.crow;
    expect(before.visible).toBe(true);
    expect(before.frame).toBe('perch0');
    expect(before.dx).toBe(30);   // AD4 F45: crowRest, not the lamp top
    expect(before.dy).toBe(26);
    for (const t of [38, 40, 47.5, 49.2]) expect(film(t, true).cast.crow.visible, `t ${t}`).toBe(false);
    const after = film(49.3, true).cast.crow;
    expect(after.visible).toBe(true);
    expect(after.frame).toBe('perch0');
  });

  it('puts every cast member on the whole row at 24.3 s, the girl gone and the props restored', () => {
    const f = film(24.3, true);
    for (const id of IDS.filter((x) => x !== 'girl')) {
      expect(f.cast[id].visible, id).toBe(true);
      expect(f.cast[id].row, id).toBe(5);
      expect(f.cast[id].blendRow, id).toBeNull();
      expect(f.cast[id].shadow, id).toBe(true);
    }
    expect(f.cast.girl.visible).toBe(false);
    expect(f.props.sprout).toBe('bloom');
    expect(f.props.puddles).toBe('whole');
    expect(f.props.chain).toBe('fallen');
    expect(f.props.hole).toBe('hidden');
    expect(f.props.receiver).toBe('onHook');
    expect(f.props.booth).toBe('restored');
    expect(f.props.clock).toBe('restored');
    expect(f.props.secondHandDeg).toBeCloseTo(0, 9);
    expect(f.props.lamp).toBe('restored');
    expect(f.props.lampGlow).toBe('warm');
    expect(f.props.motes).toBe('moth');
    expect(f.props.sensorLed).toBe('green');
    expect(f.props.lantern).toBe('fallen');
  });

  it('keeps everything on stage before 24.3 s, the shields up from 13 s, and never crossfades', () => {
    const before = film(24.29, true);
    expect(before.cast.inspector.row).toBe(4);
    expect(before.cast.inspector.shadow).toBe(false);
    expect(before.cast.girl.visible).toBe(true);
    expect(before.props.lantern).toBe('none');
    expect(before.props.sprout).toBe('stage');
    expect(before.props.sensorLed).toBe('dead');
    expect(film(15, true).cast.inspector.frame).toBe('shield');
    expect(film(20, true).cast.inspector.frame).toBe('front');
    for (const t of GRID) {
      const f = film(t, true);
      for (const id of IDS) expect(f.cast[id].blendRow, `t ${t} ${id}`).toBeNull();
    }
  });
});

describe('LAST LOOK poses', () => {
  const LL = lastLookS();

  it('is off just before 59.83 s and on at 59.83 s', () => {
    const before = film(LL - 0.01);
    expect(before.lastLook).toBe(false);
    expect(before.cast.inspector.flip).toBe(true);
    const on = film(LL);
    expect(on.lastLook).toBe(true);
    expect(on.cast.inspector).toMatchObject({ visible: true, frame: 'front', row: 5, blendRow: null, flip: false, dx: 0, dy: 0 });
    expect(on.cast.dog).toMatchObject({ frame: 'head', row: 5, dx: 0 });
    expect(on.cast.crow).toMatchObject({ frame: 'head', row: 5, dx: 30, dy: 26 });   // AD4 F45: crowRest
    expect(on.cast.sensor7).toMatchObject({ frame: 'headC', row: 5 });
    expect(on.cast.girl.visible).toBe(false);
  });

  it('blinks the booth for 250 ms, then restores it; the girl window is restored', () => {
    expect(film(LL + 0.1).props.booth).toBe('blink');
    expect(film(LL + 0.26).props.booth).toBe('restored');
    expect(film(LL - 0.01).props.girlWindow).toBe('stage');
    expect(film(LL).props.girlWindow).toBe('restored');
  });

  it('holds through the choice start and in reduced motion', () => {
    expect(film(choiceStartS() - 0.01).lastLook).toBe(true);
    expect(film(62.6).lastLook).toBe(true);
    const reduced = film(LL, true);
    expect(reduced.lastLook).toBe(true);
    expect(reduced.cast.inspector.frame).toBe('front');
  });
});

describe('choice phase', () => {
  it('is the film end state: LAST LOOK, restored props, no lead, no keep clock', () => {
    const f = frame({ phase: 'choice', t: 70 });
    expect(f.phase).toBe('choice');
    expect(f.lastLook).toBe(true);
    expect(f.keepS).toBeNull();
    expect(f.lead).toBeNull();
    expect(f.cast.inspector.frame).toBe('front');
    expect(f.props.booth).toBe('restored');
    expect(f.props.windowsAlpha).toBeCloseTo(0, 9);
    expect(f.props.virgaAlpha).toBeCloseTo(0, 9);
    expect(f.props.chladniAlpha).toBeCloseTo(0, 9);
    expect(f.props.lantern).toBe('fallen');
  });

  it('clamps an early clock to the choice start, and lastFrame forces LAST LOOK', () => {
    expect(frame({ phase: 'choice', t: 0 }).lastLook).toBe(true);
    expect(frame({ phase: 'choice', t: 0, lastFrame: true }).cast.dog).toMatchObject({ frame: 'head', dx: 0 });
    expect(frame({ phase: 'sequence', t: 20, lastFrame: true }).lastLook).toBe(false);
  });

  it('shows the red ball from cycle 2', () => {
    expect(frame({ phase: 'choice', t: 70, cycle: 1 }).props.redBall).toBe(false);
    expect(frame({ phase: 'choice', t: 70, cycle: 2 }).props.redBall).toBe(true);
    expect(film(20).props.redBall).toBe(false);
  });
});

describe('film props', () => {
  it('fades the Chladni rings from 19.3 s over 6 s', () => {
    expect(film(19.2).props.chladniAlpha).toBe(1);
    expect(film(19.3).props.chladniAlpha).toBe(1);
    expect(film(22.3).props.chladniAlpha).toBeCloseTo(0.5, 6);
    expect(film(25.3).props.chladniAlpha).toBeCloseTo(0, 6);
  });

  it('fades the windows with the skyline and the virga with the mountains', () => {
    expect(film(0).props.windowsAlpha).toBe(1);
    expect(film(0).props.virgaAlpha).toBe(1);
    expect(film(27.3).props.virgaAlpha).toBe(1);
    expect(film(33.3).props.virgaAlpha).toBeCloseTo(0, 6);
    expect(film(37.3).props.windowsAlpha).toBeCloseTo(0, 6);
  });

  it('turns the second hand 6 degrees a second from the clock restore', () => {
    const clockS = restoreTimeOf(HOME.clock);
    expect(film(clockS - 0.1).props.secondHandDeg).toBeNull();
    expect(film(clockS + 10).props.secondHandDeg).toBeCloseTo(60, 6);
    expect(film(clockS + 70).props.secondHandDeg).toBeCloseTo(60, 6);
  });
});

describe('KEEP IT RUNNING and the postgame', () => {
  it('is LAST LOOK until 1.5 s after KEEP, then everyone turns away', () => {
    const start = keep(0);
    expect(start.lastLook).toBe(true);
    expect(start.cast.inspector.frame).toBe('front');
    expect(start.cast.dog).toMatchObject({ frame: 'head', dx: 0 });
    expect(keep(1.49).lastLook).toBe(true);
    const turned = keep(1.5);
    expect(turned.lastLook).toBe(false);
    expect(turned.cast.inspector).toMatchObject({ frame: 'idleA', flip: true, dx: 0 });
    expect(turned.cast.dog).toMatchObject({ frame: 'sit0', visible: true });
    expect(turned.cast.crow).toMatchObject({ frame: 'perch0', visible: true });
    expect(turned.cast.sensor7.frame).toBe('headUp');
    expect(turned.cast.girl.visible).toBe(false);
    expect(turned.props.marksPlus).toBe(0);
  });

  // AD4 F45: the hop runs from crowRest (30, 26) by (-84, -52) to the vane finial (-54, -26), so its midpoint is (-12, 0).
  it('runs the crow beat from 3.0 s: hop from crowRest to the finial, three pecks (peck0 / peck1), hop back, then the tally mark', () => {
    expect(keep(3.0).cast.crow).toMatchObject({ frame: 'fly0', dx: 30, dy: 26 });
    const hop = keep(3.1).cast.crow;
    expect(hop.dx).toBeCloseTo(-12, 3);
    expect(hop.dy).toBeCloseTo(0, 3);
    expect(keep(3.25).cast.crow).toMatchObject({ frame: 'peck0', dx: -54, dy: -26 });
    expect(keep(3.55).cast.crow.frame).toBe('peck1');
    expect(keep(3.85).cast.crow.frame).toBe('peck0');
    expect(keep(4.05).props.marksPlus).toBe(0);
    const back = keep(4.2);
    expect(back.props.marksPlus).toBe(1);
    expect(back.cast.crow.dx).toBeCloseTo(-12, 3);
    expect(back.cast.crow.dy).toBeCloseTo(0, 3);
    expect(keep(4.4).cast.crow).toMatchObject({ frame: 'perch0', dx: 30, dy: 26 });
  });

  it('fades the dog out at its home from 4 s (alpha 1 to 0 by 4.5 s), hidden to 7 s, walks back in from the left wing, sits at 732', () => {
    expect(keep(2).cast.dog).toMatchObject({ frame: 'sit0', visible: true, alpha: 1 });
    expect(absX(keep(2), 'dog')).toBe(HOME.dog);
    expect(keep(4).cast.dog).toMatchObject({ frame: 'sit0', visible: true, alpha: 1, dx: 0, shadow: true });
    expect(keep(4.25).cast.dog).toMatchObject({ frame: 'sit0', visible: true, alpha: 0.5, shadow: true });
    expect(absX(keep(4.25), 'dog')).toBe(HOME.dog);
    expect(keep(4.5).cast.dog.visible).toBe(false);
    expect(keep(5).cast.dog.visible).toBe(false);
    expect(keep(6.99).cast.dog.visible).toBe(false);
    expect(keep(7).cast.dog).toMatchObject({ frame: 'chase0', visible: true, flip: false, alpha: 1 });
    expect(keep(7.1).cast.dog.frame).toBe('chase1');
    expect(absX(keep(7), 'dog')).toBeCloseTo(540, 6);
    expect(absX(keep(7.5), 'dog')).toBeCloseTo(636, 6);
    expect(absX(keep(8), 'dog')).toBeCloseTo(WORLD_ENDING.postgameDogHomeX, 6);
    expect(keep(8.5).cast.dog).toMatchObject({ frame: 'sit0', visible: true, flip: false });
    expect(absX(keep(8.5), 'dog')).toBeCloseTo(WORLD_ENDING.postgameDogHomeX, 6);
  });

  it('plays the postgame loop from 9 s on the loop clock, with the pat at 14.5 s', () => {
    const f = keep(9, { loopS: 14.5 });
    expect(f.cast.inspector).toMatchObject({ frame: 'pat1', dx: -42, dy: 32, flip: true, row: 5 });
    expect(absX(f, 'dog')).toBeCloseTo(WORLD_ENDING.postgameDogHomeX, 6);
    expect(f.cast.dog.frame).toBe('wag');
    expect(f.props.marksPlus).toBe(1);
  });

  it('boots into postgame with the loop only: no KEEP beats, the tally mark on, the loop clock wraps', () => {
    const boot = keep(Infinity, { loopS: 14.5 });
    expect(boot.keepS).toBe(Infinity);
    expect(boot.lastLook).toBe(false);
    expect(boot.cast.inspector).toMatchObject({ frame: 'pat1', dx: -42, dy: 32 });
    expect(absX(boot, 'dog')).toBeCloseTo(WORLD_ENDING.postgameDogHomeX, 6);
    expect(boot.props.marksPlus).toBe(1);
    expect(boot.cast.girl.visible).toBe(false);
    const wrapped = keep(Infinity, { loopS: 104.5 });
    expect(wrapped.cast.inspector.dx).toBeCloseTo(-42, 9);
    expect(wrapped.cast.inspector.frame).toBe('pat1');
  });

  it('forces LAST LOOK in postgame with lastFrame, the dog on its postgame spot', () => {
    const f = keep(20, { lastFrame: true });
    expect(f.lastLook).toBe(true);
    expect(f.cast.inspector).toMatchObject({ frame: 'front', row: 5, dx: 0, dy: 0 });
    expect(f.cast.dog).toMatchObject({ frame: 'head', row: 5 });
    expect(absX(f, 'dog')).toBeCloseTo(WORLD_ENDING.postgameDogHomeX, 6);
    expect(f.lead).toBeNull();
  });

  it('turns the Sensor 7 head to camera only during the camera turn', () => {
    expect(keep(20, { loopS: 0, sensorTurn: true }).cast.sensor7.frame).toBe('headC');
    expect(keep(20, { loopS: 0, sensorTurn: true }).props.sensorGlyph).toBe('one');
    expect(keep(20, { loopS: 0 }).cast.sensor7.frame).toBe('headUp');
    expect(keep(20, { loopS: 0 }).props.sensorGlyph).toBe('dash');
  });

  it('shows the restored world in the postgame props, the second hand on the loop clock after a boot', () => {
    const p = keep(Infinity, { loopS: 10 }).props;
    expect(p.lamp).toBe('restored');
    expect(p.lampGlow).toBe('warm');
    expect(p.clock).toBe('restored');
    expect(p.secondHandDeg).toBeCloseTo(60, 9);
    expect(p.booth).toBe('restored');
    expect(p.receiver).toBe('onHook');
    expect(p.girlWindow).toBe('restored');
    expect(p.lantern).toBe('fallen');
    expect(p.redBall).toBe(true);
    expect(p.motes).toBe('moth');
    expect(p.windowsAlpha).toBe(0);
    expect(p.virgaAlpha).toBe(0);
    expect(p.chladniAlpha).toBe(0);
    expect(p.sensorLed).toBe('green');
    expect(p.sprout).toBe('bloom');
    expect(p.puddles).toBe('whole');
    expect(p.chain).toBe('fallen');
    expect(p.hole).toBe('hidden');
  });

  it('second hand is continuous from the choice into KEEP, full and reduced motion', () => {
    const endT = 64.47;   // the frozen film clock (any time from the choice start)
    for (const reduced of [false, true]) {
      const choice = handOf(frame({ phase: 'choice', t: endT, reduced }));
      const keepStart = handOf(keep(0, { t: endT, loopS: 0, reduced }));
      expect(Math.abs(angleDelta(choice, keepStart)), `reduced ${reduced}`).toBeLessThan(1);
    }
  });

  it('second hand keeps sweeping through the loop start: 6 degrees a second from the choice, past KEEP + 9 s', () => {
    const endT = 64.47;
    const clockRestore = restoreTimeOf(HOME.clock);
    const hand = (keepS: number): number => handOf(keep(keepS, { t: endT, loopS: 0 }));
    for (const keepS of [1, 5, 9, 12]) {
      const want = wrapDeg(6 * (Math.max(endT, choiceStartS()) - clockRestore + keepS));
      expect(hand(keepS), `keepS ${keepS}`).toBeCloseTo(want, 6);
    }
    for (const s of [4, 8, 9, 11]) expect(angleDelta(hand(s), hand(s + 1)), `keepS ${s} to ${s + 1}`).toBeCloseTo(6, 6);
  });

  it('a boot into the postgame runs the hand on the loop clock: 0 degrees at loop 0, 60 at loop 10', () => {
    expect(handOf(keep(Infinity, { loopS: 0 }))).toBeCloseTo(0, 9);
    expect(handOf(keep(Infinity, { loopS: 10 }))).toBeCloseTo(60, 9);
  });

  it('reports the KEEP clock as keepS (null before KEEP, Infinity after a boot)', () => {
    expect(keep(3).keepS).toBe(3);
    expect(film(5).keepS).toBeNull();
    expect(frame({ phase: 'choice', t: 70 }).keepS).toBeNull();
    expect(keep(Infinity).keepS).toBe(Infinity);
  });
});

describe('dog clear of the machine box', () => {
  it('keeps the dog out of the box on every postgame loop position', () => {
    for (let i = 0; i < 720; i++) {
      const f = keep(Infinity, { loopS: i / 8 });
      const x = absX(f, 'dog');
      expect(x < BOX_LEFT || x > BOX_RIGHT, `loop ${i / 8}`).toBe(true);
    }
  });

  it('never overlaps an anchor box while the dog is visible (centre +/- 28 px): every KEEP 0-12 s and loop 0-90 s position', () => {
    const overlaps = (x: number): boolean => ANCHOR_BOXES.some(([a, b]) => x + DOG_HALF_W > a && x - DOG_HALF_W < b);
    const frames: WorldScriptFrame[] = [];
    for (let i = 0; i <= 240; i++) frames.push(keep(i * 0.05));
    for (let i = 0; i <= 900; i++) frames.push(keep(Infinity, { loopS: i * 0.1 }));
    const seen = frames.filter((f) => f.cast.dog.visible && f.cast.dog.alpha > 0);
    expect(seen.length).toBeGreaterThan(300);
    expect(seen.filter((f) => overlaps(absX(f, 'dog'))).map((f) => `keep ${f.keepS} x ${absX(f, 'dog')}`)).toEqual([]);
  });

  it('hides the dog from 4.5 s to 7 s and keeps the re-entry start off screen (portrait view 640-3200)', () => {
    const n = WORLD_ENDING.keep.dogEnter;
    expect(n.fromX + DOG_HALF_W).toBeLessThanOrEqual(VIEW_LEFT);
    expect(keep(WORLD_ENDING.keep.dogFade.toS).cast.dog.visible).toBe(false);
    expect(keep(n.fromS - 0.001).cast.dog.visible).toBe(false);
    expect(keep(n.fromS).cast.dog.visible).toBe(true);
  });

  it('walks the re-entry at the stride: 192 px a second (16 px at 12 fps)', () => {
    const n = WORLD_ENDING.keep.dogEnter;
    const stride = WORLD_ENDING.dogStride.worldPxPerFrame * WORLD_ENDING.dogStride.fps;
    expect((WORLD_ENDING.postgameDogHomeX - n.fromX) / (n.toS - n.fromS)).toBeCloseTo(stride, 6);
  });
});

// AD4 F45: every crow pose carries crowRest (the kite's lamp-arm end, not the lamp top); the KEEP pecks sit on the vane finial.
describe('crow rest (AD4 F45)', () => {
  const LIFT = WORLD_ERA_ENV.crowPerchLiftArtPx * PIXEL_SCALE;   // the crow's home feet line above the ground: 112
  const hosted = (id: 'spliceVane' | 'spliceKite'): { dx: number; dy: number } => {
    const e = SPLICE_WORLD[id];
    const p = e?.placements.portrait;
    if (e === undefined || e.perchTop === undefined || p === undefined || p === null || p.lane !== 'back') throw new Error(`no portrait perch for ${id}`);
    return { dx: p.x + e.perchTop.dx - WORLD_ENDING.homeX.crow, dy: e.perchTop.dy + LIFT };
  };
  const KITE_ARM = hosted('spliceKite');   // (30, 26)
  const FINIAL = hosted('spliceVane');     // (-54, -26)
  it('derives the kite arm end (30, 26) and the vane finial (-54, -26) from the objects: crowRest is the kite arm', () => {
    expect(KITE_ARM).toEqual({ dx: 30, dy: 26 });
    expect(FINIAL).toEqual({ dx: -54, dy: -26 });
    expect(WORLD_ENDING.crow.crowRest).toEqual(KITE_ARM);
  });
  it('every crow pose includes crowRest: perched poses sit on it, the pecks sit on the finial', () => {
    const frames: WorldScriptFrame[] = [];
    for (const t of GRID) frames.push(film(t), film(t, true));
    frames.push(frame({ phase: 'choice', t: 70 }), frame({ phase: 'choice', t: 70, lastFrame: true }));
    for (let i = 0; i <= 240; i++) frames.push(keep(i * 0.05));
    for (let i = 0; i <= 900; i++) frames.push(keep(Infinity, { loopS: i * 0.1 }));
    const crows = frames.map((f) => f.cast.crow).filter((p) => p.visible);
    const perched = crows.filter((p) => !/^(fly|peck)/.test(p.frame));
    expect(perched.length).toBeGreaterThan(300);
    expect(perched.filter((p) => p.dx !== KITE_ARM.dx || p.dy !== KITE_ARM.dy).map((p) => `${p.frame} ${p.dx},${p.dy}`)).toEqual([]);
    const pecks = crows.filter((p) => /^peck/.test(p.frame));
    expect(pecks.length).toBeGreaterThan(0);
    expect(pecks.filter((p) => p.dx !== FINIAL.dx || p.dy !== FINIAL.dy).map((p) => `${p.frame} ${p.dx},${p.dy}`)).toEqual([]);
  });

  it('hops from crowRest to the finial: mid-hop (-12, 0), pecks on the finial, the hop-out never overshoots it', () => {
    const mid = keep(3.1).cast.crow;
    expect(mid.dx).toBeCloseTo((KITE_ARM.dx + FINIAL.dx) / 2, 9);
    expect(mid.dy).toBeCloseTo((KITE_ARM.dy + FINIAL.dy) / 2, 9);
    expect(mid.dx).toBeCloseTo(-12, 6);
    expect(mid.dy).toBeCloseTo(0, 6);
    expect(keep(3.2).cast.crow).toMatchObject({ frame: 'peck0', dx: FINIAL.dx, dy: FINIAL.dy });
    for (let i = 0; i <= 20; i++) {   // k 3.0 to 3.2 s
      const k = 3 + i * 0.01;
      const p = keep(k).cast.crow;
      expect(p.dx, `k ${k}`).toBeGreaterThanOrEqual(FINIAL.dx - 1e-9);
      expect(p.dy, `k ${k}`).toBeGreaterThanOrEqual(FINIAL.dy - 1e-9);
    }
  });

  it('starts and ends the flights on crowRest: the takeoff, the glide home and the KEEP hop out and back', () => {
    expect(film(37).cast.crow).toMatchObject({ dx: KITE_ARM.dx, dy: KITE_ARM.dy });
    expect(film(49.3).cast.crow).toMatchObject({ dx: KITE_ARM.dx, dy: KITE_ARM.dy });
    expect(keep(3.0).cast.crow).toMatchObject({ dx: KITE_ARM.dx, dy: KITE_ARM.dy });
    expect(keep(4.35).cast.crow).toMatchObject({ frame: 'perch0', dx: KITE_ARM.dx, dy: KITE_ARM.dy });
    expect(keep(3.2).cast.crow).toMatchObject({ frame: 'peck0', dx: FINIAL.dx, dy: FINIAL.dy });
  });
});

describe('every pose on its sheet', () => {
  it('uses frames that exist on their sheet and rows 0..5 in every film, choice and postgame frame', () => {
    const frames: WorldScriptFrame[] = [];
    for (const t of GRID) {
      frames.push(film(t), film(t, true));
    }
    frames.push(frame({ phase: 'choice', t: 62.6 }), frame({ phase: 'choice', t: 70, lastFrame: true }));
    for (const keepS of [0, 0.5, 1.5, 3, 3.5, 4.2, 5, 6.5, 7.5, 8.5, 9, 30, Infinity]) {
      for (let i = 0; i <= 12; i++) {
        frames.push(keep(keepS, { loopS: i * 7.5 }), keep(keepS, { loopS: i * 7.5, sensorTurn: true, lastFrame: i === 3 }));
      }
    }
    for (const f of frames) {
      for (const id of IDS) {
        const p: CastScriptPose = f.cast[id];
        expect(WORLD_FRAMES[SHEET[id]], `${id} ${p.frame} @${f.phase} ${f.t}`).toContain(p.frame);
        expect(Number.isInteger(p.row) && p.row >= 0 && p.row <= 5, `${id} row ${p.row}`).toBe(true);
        expect(p.blendRow === null || (Number.isInteger(p.blendRow) && p.blendRow >= 0 && p.blendRow <= 5)).toBe(true);
        expect(p.blend >= 0 && p.blend <= 1).toBe(true);
        if (!p.visible) expect(p.shadow, `${id} hidden shadow`).toBe(false);
        expect(p.alpha >= 0 && p.alpha <= 1, `${id} alpha`).toBe(true);
        expect([undefined, 'back', 'front']).toContain(p.worldRow);
      }
    }
  });
});

describe('worldRow: the postgame draw row', () => {
  it('is undefined in the film, LAST LOOK, the LAST FRAME set and the choice', () => {
    for (const t of GRID) for (const id of IDS) expect(film(t).cast[id].worldRow, `t ${t} ${id}`).toBeUndefined();
    for (const id of IDS) {
      expect(keep(1).cast[id].worldRow, `LAST LOOK ${id}`).toBeUndefined();
      expect(keep(20, { lastFrame: true }).cast[id].worldRow, `LAST FRAME ${id}`).toBeUndefined();
      expect(frame({ phase: 'choice', t: 70 }).cast[id].worldRow, `choice ${id}`).toBeUndefined();
    }
  });

  it('is front for the dog through the KEEP fade, the re-entry and the loop', () => {
    expect(keep(4.25).cast.dog.worldRow).toBe('front');
    expect(keep(7.5).cast.dog.worldRow).toBe('front');
    expect(keep(9, { loopS: 14.5 }).cast.dog.worldRow).toBe('front');
    expect(keep(Infinity, { loopS: 40 }).cast.dog.worldRow).toBe('front');
  });

  it('is front for the Inspector while it walks and pats, back while it writes', () => {
    expect(keep(9, { loopS: 14.5 }).cast.inspector.worldRow).toBe('front');
    expect(keep(Infinity, { loopS: 40 }).cast.inspector.worldRow).toBe('back');
  });
});

describe('worldFinale purity', () => {
  it('stays free of Phaser and DOM globals', () => {
    const src = readFileSync(new URL('./worldFinale.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from\s+['"][^'"]*phaser/i);
    expect(src).not.toContain('document.');
    expect(src).not.toContain('window.');
  });
});
