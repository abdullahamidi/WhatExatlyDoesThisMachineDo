// Poke data (WP28a T15a): the ladder numbers, the sound and light ids, the answer tables per target and era, the crow perches and the
// crow hop. Why: the ladder (src/game/math/pokes.ts), the cast overlay and the director read one copy of every frame, light, sound and
// number. Pure data: no Phaser.
// Canon: a cast answer draws frames of its own sheet (POKE_SHEET). The girl and the props answer with light and sound only (frames []),
// so the girl never moves on screen (C12). Sensor 7 never shows glyphOne or headUp (C7). Era V answers use the stare-safe frames of the
// era (the stare shows camera-facing frames only). Era IV answers are one off-beat accent frame (C11). Every answer totals at most
// POKES.maxAnswerMs (the wordless unavailable ones POKES.unavailableAnswerMs). Pinned in src/game/math/pokes.test.ts.
import { WORLD_PLACEMENTS } from './livingWorld';
import type { FramingKey, WorldSheetId } from './livingWorld';
import { GROUND_Y } from './world';

export type PokeSoundId = 'tick' | 'pencil' | 'woof' | 'caw' | 'beep' | 'ring' | 'tink' | 'note' | 'organ' | 'bell' | 'crackle' | 'buzz';
// What else an answer lights or moves: the lantern ring, the mini's lantern, the window, the LED, the lens, the hood, the receiver, the lamp,
// the clock, a woken object's twitch.
export type PokeLightId = 'lanternRing' | 'miniDim' | 'windowDark' | 'windowFlicker' | 'ledBlink' | 'ledSolid' | 'lensGlint' | 'hoodBlink'
  | 'ringBurst' | 'receiverSway' | 'lampBump' | 'clockTwitch' | 'clockTick' | 'objectTwitch';

// One answer. frames are frame names of the target's sheet (none for a light or sound answer); frameMs holds each frame; durMs is the whole
// answer. sound null is a silent answer (the era I payphone). light and alpha tag the lit or dimmed part (the lantern, the LED, the hood).
export interface PokeClip {
  id: string;
  frames: readonly string[];
  frameMs: readonly number[];
  durMs: number;
  sound: PokeSoundId | null;
  light?: PokeLightId;
  alpha?: number;
}
// The answers of one target in one era. l1 is the level-1 bag (two or more clips, so a bag never repeats a reaction); l2 is one clip;
// l3 is the opening beat of level 3 (the level-2 clip when the target has no leave); leave is the Activity id that level 3 starts through
// BehaviourRunner.interrupt (null: no walk); unavailable holds the two wordless answers that alternate for POKES.unavailableMs after level 3.
export interface PokeTable {
  l1: readonly PokeClip[];
  l2: PokeClip;
  l3: PokeClip;
  leave: string | null;
  unavailable: readonly [PokeClip, PokeClip];
}
export type PokeTargetKey = 'inspector' | 'dog' | 'crow' | 'girlWindow' | 'girlMini' | 'girlGround' | 'sensor7' | 'payphone' | 'lamp' | 'clock'
  | 'object';
// The woken Splice objects: a key 'object:<id>' (POKE_OBJECT_KEY) reads POKE_OBJECT_TABLES[id] when the object has its own table, else the
// 'object' table; each object keeps its own ladder count.
export const POKE_OBJECT_KEY = 'object:';
// The sheet of each cast target's frames. The girl and the props have none (light and sound only).
export const POKE_SHEET: Partial<Record<PokeTargetKey, WorldSheetId>> = { inspector: 'inspector', dog: 'dog', crow: 'crow', sensor7: 'sensor7' };

// The ladder and the timing. minGapMs: a poke this soon after the last accepted one on its target is ignored (no sound). ackMs: the
// bracket flash (the director). answerDelayMs: the answer starts this far after the poke (a hash of the target and the count). windowMs:
// the pokes that count toward the level. resetMs: the count starts again after this long without a poke. unavailableMs: the wordless window
// after level 3. maxAnswerMs and unavailableAnswerMs cap the clips. reducedHoldMs: the one held frame of a reduced-motion answer. bagAvoid:
// the picks a bag avoids. soundAvoid: the sound variants a shuffle avoids (each clip has one fixed sound; the audio layer varies the pitch).
export const POKES = {
  minGapMs: 600, ackMs: 100, answerDelayMs: [300, 500], windowMs: 8000, resetMs: 25000, unavailableMs: 20000, levelTwoAt: 3,
  levelThreeAt: 4, maxAnswerMs: 2000, unavailableAnswerMs: 800, bagAvoid: 2, soundAvoid: 2, reducedHoldMs: 1200,
} as const;

// A frame answer: frames is the space-separated list of frame names; frameMs is one hold for every frame or one hold per frame; durMs is the sum.
// The sound is 'tick' unless given (most answers are ticks; null is the silent answer).
const framed = (id: string, frames: string, frameMs: number | readonly number[], sound: PokeSoundId | null = 'tick', light?: PokeLightId): PokeClip => {
  const names = frames.split(' ');
  const holds = typeof frameMs === 'number' ? names.map(() => frameMs) : frameMs;
  return { id, frames: names, frameMs: holds, durMs: holds.reduce((sum, ms) => sum + ms, 0), sound, light };
};
// A light or sound answer with no frame: the light lasts durMs; alpha dims a lantern.
const lit = (id: string, light: PokeLightId, durMs: number, sound: PokeSoundId | null = 'tick', alpha?: number): PokeClip => ({
  id, frames: [], frameMs: [], durMs, sound, light, alpha,
});
// A woken Splice object's twitch: a light answer on 'objectTwitch' (the sound is 'tick' unless given).
const twitch = (id: string, durMs: number, sound: PokeSoundId = 'tick'): PokeClip => lit(id, 'objectTwitch', durMs, sound);
const five = <T>(table: T): readonly T[] => [table, table, table, table, table];
// One target's answers in one era, in order: the level-1 bag, the level-2 clip, the level-3 clip, the leave id (null: no walk) and the two
// wordless answers.
const table = (l1: readonly PokeClip[], l2: PokeClip, l3: PokeClip, leave: string | null, unavailable: readonly [PokeClip, PokeClip]): PokeTable =>
  ({ l1, l2, l3, leave, unavailable });

// Clips two targets share (the same frames, hold and sound): the wordless look and head of the dog, the stare's talk, the accent look.
const DOG_IDLE_LOOK = framed('dogIdleLookUp', 'lookUp', 700);
const DOG_IDLE_HEAD = framed('dogIdleHead', 'head', 700);
const STARE_IDLE_TALK = framed('dogVIdleTalk', 'talk', 700);
const ACCENT_LOOK = framed('dogAccentLook', 'lookUp', 600);
// The Inspector (eras I-III): the reading glance, the writing, the look up, the watch and the front. Level 2 is the "Noted." beat (WP28b adds
// the bubble). Level 3 walks to the outer spot and writes there (leaveWrite; the glance is its opening beat).
const INS_FRONT = framed('insFront', 'front', 1000);
const INS_I: PokeTable = table(
  [framed('insGlance', 'glance', 1200), framed('insWrite', 'write0 write1 write0 write1', 260, 'pencil'),
    framed('insLookUp', 'lookUp', 1000), framed('insWatch', 'watch', 1500), INS_FRONT],
  framed('insNoted', 'glance write0 write1 write0 write1 write0 write1', [600, 220, 220, 220, 220, 220, 220], 'pencil'),
  framed('insLeave', 'glance', 800),
  'leaveWrite',
  [framed('insIdleGlance', 'glance', 700), DOG_IDLE_LOOK],
);
// The Inspector in era IV: one off-beat accent frame (C11; the still accent write0, the mouth accent talk).
const INS_ACCENT_TALK = framed('insAccentTalk', 'talk', 600);
const INS_IV: PokeTable = table(
  [framed('insAccentWrite', 'write0', 600, 'pencil'), INS_ACCENT_TALK], ACCENT_LOOK, ACCENT_LOOK, null,
  [framed('insIvWrite', 'write0', 600), INS_ACCENT_TALK],
);
// The Inspector in era V (the stare): front and talk frames only.
const INS_V: PokeTable = table(
  [framed('insVGlance', 'front', 1200), framed('insVWrite', 'talk front talk front', 250, 'pencil'), INS_FRONT,
    framed('insVWatch', 'front', 1500)],
  framed('insVNoted', 'front talk front talk front talk front', [600, 220, 220, 220, 220, 220, 220], 'pencil'),
  framed('insVLeave', 'front', 800),
  null,
  [framed('insVIdleFront', 'front', 700), STARE_IDLE_TALK],
);

// The dog's clips shared by eras I and V (the same frames and sound): the head, the talk, the woofs and the trot.
const DOG_HEAD = framed('dogHead', 'head', 1000);
const DOG_TALK = framed('dogTalk', 'talk', 900, 'woof');
const DOG_WOOFS = framed('dogWoofs', 'talk talk head', [400, 400, 600], 'woof');
const DOG_TROT = framed('dogTrot', 'talk talk', 350, 'woof');
// The dog (eras I-III): the look up, the head, the wag, the scratch, the sniff and the talk with a woof. Level 3 woofs and trots to the
// outer spot and sits (leaveSit); a sleeping dog wakes first (the director plays the look up before the leave).
const DOG_I: PokeTable = table(
  [framed('dogLookUp', 'lookUp', 1000), DOG_HEAD, framed('dogWag', 'wag sit0 wag sit0', 250),
    framed('dogScratch', 'scratch0 scratch1 scratch0 scratch1', 250), framed('dogSniff', 'sniff0 sniff1 sniff0 sniff1', 300),
    DOG_TALK],
  DOG_WOOFS, DOG_TROT, 'leaveSit', [DOG_IDLE_HEAD, DOG_IDLE_LOOK],
);
// The dog in era IV: one off-beat accent frame each (the head and the mouth accent; C11).
const DOG_IV: PokeTable = table(
  [framed('dogAccentHead', 'head', 600), framed('dogAccentTalk', 'talk', 600, 'woof')], ACCENT_LOOK, ACCENT_LOOK, null,
  DOG_I.unavailable,
);
// The dog in era V (the stare): head and talk frames only.
const DOG_V: PokeTable = table(
  [DOG_HEAD, DOG_TALK, framed('dogVHeadTalk', 'head talk head', 400), framed('dogVStill', 'head head', 600)],
  DOG_WOOFS, DOG_TROT, null, [DOG_IDLE_HEAD, STARE_IDLE_TALK],
);

// The caw beat (eras I and IV share it) and the hop beat (the level-3 caw of era I, the era IV accent caw).
const CROW_CAW = framed('crowCaw', 'perchTalk', 900, 'caw');
const CROW_HOP_BEAT = framed('crowHopBeat', 'perchTalk', 600, 'caw');
// The crow (eras I-III): the ruffle, the perch turn, the caw, the peck and the perch head. Level 3 is the caw beat, then the hop (C3).
const CROW_I: PokeTable = table(
  [framed('crowRuffle', 'ruffle', 800), framed('crowTurn', 'perchTurn', 900), CROW_CAW,
    framed('crowPeck', 'peck0 peck1 peck0 peck1', 250), framed('crowHead', 'perchHead', 900)],
  framed('crowCaws', 'perchTalk perchTalk ruffle', [500, 500, 700], 'caw'),
  CROW_HOP_BEAT,
  'hop',
  [framed('crowIdleHead', 'perchHead', 700), framed('crowIdleTurn', 'perchTurn', 700)],
);
// The crow in era IV: it rises a pixel and caws (no hop); folded-wing frames only (AD2 F9).
const CROW_IV: PokeTable = table(
  [CROW_HOP_BEAT, framed('crowAccentHead', 'perchHead', 600)], CROW_CAW, CROW_CAW, null, CROW_I.unavailable,
);
// The crow in era V (the stare): head and talk frames only; the hop is the one exemption (C3, the poke-only 'hop' activity).
const CROW_V: PokeTable = table(
  [framed('crowVHead', 'head', 900), framed('crowVCaw', 'talk', 900, 'caw'), framed('crowVHeadTalk', 'head talk head', 350, 'caw'),
    framed('crowVStutter', 'head head', 400)],
  framed('crowVCaws', 'talk talk head', [400, 400, 600], 'caw'),
  framed('crowVHopBeat', 'talk', 600, 'caw'),
  'hop',
  [DOG_IDLE_HEAD, STARE_IDLE_TALK],
);

// Sensor 7: the LED double blink with the head snapping to the centre (a beep). Levels 2 and 3 are the solid LED (the Director draws a 150 ms
// lens glint at its start, then the LED solid). Never glyphOne, never headUp (C7).
const S7_SOLID = framed('s7Solid', 'headC', 1900, 'beep', 'ledSolid');
const SENSOR7: PokeTable = table(
  [framed('s7Blink', 'headC', 900, 'beep', 'ledBlink'), framed('s7Snap', 'headL headC', [250, 650], 'beep', 'ledBlink')],
  S7_SOLID, S7_SOLID, null, [lit('s7IdleBlink', 'ledBlink', 500, 'beep'), lit('s7IdleGlint', 'lensGlint', 300)],
);

// The girl's window (era I): dark for 2 s and back. Level 2 holds the dark (10 s in the plan, cut to 2 s by the answer cap); level 3 shows the
// other flicker at the next unseen moment (the director).
const WIN_DARK = lit('winDark', 'windowDark', 2000);
const WIN_FLICKER = lit('winFlicker', 'windowFlicker', 1000);
const GIRL_WINDOW: PokeTable = table(
  [WIN_DARK, WIN_FLICKER], WIN_DARK, WIN_FLICKER, null,
  [lit('winIdleDark', 'windowDark', 600), lit('winIdleFlicker', 'windowFlicker', 500)],
);
// The girl as a mini (eras II-III): the lantern dims to alpha 0.55 for 2 s (level 2 cut from 10 s to the 2 s cap).
const MINI_DIM = lit('miniDim', 'miniDim', 2000, 'tick', 0.55);
const GIRL_MINI: PokeTable = table(
  [MINI_DIM, lit('miniLow', 'miniDim', 1000, 'tick', 0.7)], MINI_DIM, MINI_DIM, null,
  [lit('miniIdle07', 'miniDim', 500, 'tick', 0.7), lit('miniIdle04', 'miniDim', 500, 'tick', 0.4)],
);
// The girl on the ground (cycle 3 on, eras IV-V): one music-box note and a 1 px lantern ring pulse. Level 3: her pose changes (tilt) at
// the next unseen moment; the director times the leave (C12: she never moves on screen).
const GROUND_NOTE_L2 = lit('groundNoteL2', 'lanternRing', 1200, 'note');
const GROUND_NOTE = lit('groundNote', 'lanternRing', 300, 'note');
const GIRL_GROUND: PokeTable = table(
  [GROUND_NOTE, lit('groundNoteLong', 'lanternRing', 600, 'note')], GROUND_NOTE_L2, GROUND_NOTE_L2, 'tilt',
  [GROUND_NOTE, lit('groundNoteB', 'lanternRing', 300, 'note')],
);

// The payphone: era I is a silent receiver sway (C4); from era II a ring burst and a receiver swing, and the hood light blinks three times.
const PAY_HOOD_I = lit('payHoodI', 'hoodBlink', 900, null);
const PAYPHONE_I: PokeTable = table(
  [lit('payReceiverSway', 'receiverSway', 500, null), lit('payReceiverSwayLong', 'receiverSway', 900, null)], PAY_HOOD_I, PAY_HOOD_I, null,
  [lit('payIdleHoodI', 'hoodBlink', 600, null), lit('payIdleSwayI', 'receiverSway', 600, null)],
);
const PAY_SWING = lit('payReceiverSwing', 'receiverSway', 600);
const PAY_HOOD = lit('payHood', 'hoodBlink', 900);
const PAYPHONE_II: PokeTable = table(
  [lit('payRing', 'ringBurst', 400, 'ring'), PAY_SWING], PAY_HOOD, PAY_HOOD, null, [lit('payIdleHood', 'hoodBlink', 600), PAY_SWING],
);

// The lamp (every era): a glow bump; a dead lamp answers with a metal tink (the director's state).
const LAMP_TINK = lit('lampTink', 'lampBump', 400, 'tink');
const LAMP_L2 = lit('lampBumpL2', 'lampBump', 900);
const LAMP: PokeTable = table(
  [lit('lampBump', 'lampBump', 600), LAMP_TINK], LAMP_L2, LAMP_L2, null, [lit('lampIdleA', 'lampBump', 400), LAMP_TINK],
);

// The clock (every era): the minute twitch of a dead clock, and the one tick that snaps back to 4:41 once it is woken (C6).
const CLOCK_TWITCH = lit('clockTwitch', 'clockTwitch', 300);
const CLOCK_TICK = lit('clockTick', 'clockTick', 250);
const CLOCK: PokeTable = table([CLOCK_TWITCH, CLOCK_TICK], CLOCK_TWITCH, CLOCK_TWITCH, null, [CLOCK_TWITCH, CLOCK_TICK]);

// The woken Splice objects: a twitch is a light answer on 'objectTwitch' (twitch). Levels 2 and 3 share one short twitch, and the clips that
// two objects share (an idle organ, an idle tink, an idle note) are one clip each.
const OBJ_TWITCH = twitch('objTwitchL2', 600);
const OBJ_ORGAN = twitch('objOrgan', 1200, 'organ');
const OBJ_BICYCLE = twitch('objBicycle', 800, 'bell');
const OBJ_RADIO = twitch('objRadio', 1200, 'crackle');
const OBJ_SIGN = twitch('objSign', 900, 'buzz');
const IDLE_ORGAN = twitch('objIdleOrgan', 300, 'organ');
const IDLE_TINK = twitch('objIdleTink', 300, 'tink');
const IDLE_NOTE = twitch('objIdleNote4', 300, 'note');
// The second wordless variant of the four own-art objects: one tick clip (equal frames and sound are one clip).
const IDLE_TICK = twitch('objIdleTick', 300);
// One object's table: the level-1 bag, the shared twitch at levels 2 and 3, no leave, and the two wordless sound variants.
const objectTable = (l1: readonly PokeClip[], unavailable: readonly [PokeClip, PokeClip]): PokeTable =>
  table(l1, OBJ_TWITCH, OBJ_TWITCH, null, unavailable);
// The other woken Splice objects, per era (the ten without an own table; WP28b adds their signature actions).
const OBJECT_I: PokeTable = objectTable([OBJ_ORGAN, OBJ_BICYCLE], [IDLE_ORGAN, twitch('objIdleBell', 300, 'bell')]);
const OBJECT_II: PokeTable = objectTable([OBJ_RADIO, OBJ_SIGN], [twitch('objIdleCrackle', 300, 'crackle'), twitch('objIdleBuzz', 300, 'buzz')]);
const OBJECT_III: PokeTable = objectTable(
  [twitch('objPump', 800, 'tink'), twitch('objWhistle', 1200, 'beep'), twitch('objHydrant', 900, 'crackle')],
  [IDLE_TINK, twitch('objIdleBeep', 300, 'beep')],
);
const OBJECT_IV: PokeTable = objectTable(
  [twitch('objBell', 900, 'bell'), twitch('objGramophone', 1200, 'note')],
  [twitch('objIdleBell4', 300, 'bell'), IDLE_NOTE],
);
const OBJECT_V: PokeTable = objectTable(
  [twitch('objVane', 900, 'tink'), twitch('objKite', 1200, 'note'), twitch('objCairn', 800, 'tink')],
  [IDLE_TINK, IDLE_NOTE],
);
// The four own-art Splice objects (AD2 F10): one table each, the same in every era. Level 1 is the object's own signature pair; the unavailable
// pair is its idle sound (the first clip's sound) and a tick (the object's two sound variants).
export const POKE_OBJECT_TABLES: Readonly<Record<string, readonly PokeTable[]>> = {
  spliceBicycle: five(objectTable([OBJ_BICYCLE, twitch('objBicycleSpin', 600)], [twitch('objIdleBicycle', 300, 'bell'), IDLE_TICK])),
  spliceOrgan: five(objectTable([OBJ_ORGAN, twitch('objOrganPuff', 600)], [IDLE_ORGAN, IDLE_TICK])),
  spliceRadio: five(objectTable([OBJ_RADIO, twitch('objRadioDial', 600)], [twitch('objIdleRadio', 300, 'crackle'), IDLE_TICK])),
  spliceSign: five(objectTable([OBJ_SIGN, twitch('objSignFlicker', 600)], [twitch('objIdleSign', 300, 'buzz'), IDLE_TICK])),
};

// The answers per target, index = era - 1 (eras I-V). Eras with the same answers share one table.
export const POKE_TABLES: Readonly<Record<PokeTargetKey, readonly PokeTable[]>> = {
  inspector: [INS_I, INS_I, INS_I, INS_IV, INS_V],
  dog: [DOG_I, DOG_I, DOG_I, DOG_IV, DOG_V],
  crow: [CROW_I, CROW_I, CROW_I, CROW_IV, CROW_V],
  girlWindow: five(GIRL_WINDOW),
  girlMini: five(GIRL_MINI),
  girlGround: five(GIRL_GROUND),
  sensor7: five(SENSOR7),
  payphone: [PAYPHONE_I, PAYPHONE_II, PAYPHONE_II, PAYPHONE_II, PAYPHONE_II],
  lamp: five(LAMP),
  clock: five(CLOCK),
  object: [OBJECT_I, OBJECT_II, OBJECT_III, OBJECT_IV, OBJECT_V],
};

// The crow's perches per framing (right wing only; never on the machine, the far planes or Sensor 7). x is the world x of the perch, y the
// feet (GROUND_Y minus the height of the perch). The drop wire (era II+, while the Payphone line is woken) is added by the director.
// s8, s8w and s10 come from the AD1 hand-off (section f). s10 has none: the crow is off-stage there (a documented exemption).
export interface CrowPerch { id: string; x: number; y: number; droppedWire?: boolean }
// The dog's x on e1 (its placement; the e1 ground perch is 36 px right of it; the pokes test pins 2400).
const E1_DOG_X = WORLD_PLACEMENTS.e1.dog?.x ?? 0;
// lampTop and boothRoof stand on the lamp's and the booth's top opaque row (AD2 F8). groundDog is the ground by the dog: 36 px right of the dog
// on e1, 2924 on s9 and s11 (AD1: the dog x + 36 stood the crow in the hole). Its feet sit below the ground line, the one exemption from
// 'above the ground' (pokes.test.ts). s15 has no clockTop: a hop to x 2890 is always refused there (the machine spans 848-2992).
// A perch whose feet stand rise px above the ground line.
const perch = (id: string, x: number, rise: number): CrowPerch => ({ id, x, y: GROUND_Y - rise });
export const CROW_PERCHES: Partial<Record<FramingKey, readonly CrowPerch[]>> = {
  e1: [
    perch('lampTop', 2476, 112), perch('boothRoof', 2420, 102), perch('clockTop', 2516, 88), { id: 'groundDog', x: E1_DOG_X + 36, y: GROUND_Y + 32 },
  ],
  s8: [perch('lampTop', 2656, 112), perch('boothRoof', 2604, 102), perch('clockTop', 2680, 88)],
  s8w: [perch('lampTop', 2720, 112), perch('boothRoof', 2678, 102)],
  s9: [
    perch('lampTop', 2996, 112), perch('boothRoof', 2944, 102), perch('clockTop', 2900, 88),
    // The drop wire is the payphone's cable (era II+): the director includes it only while the Payphone line is woken and the cable mast stands.
    { id: 'dropWire', x: 2864, y: GROUND_Y - 149, droppedWire: true },
    { id: 'groundDog', x: 2924, y: GROUND_Y + 32 },
  ],
  s10: [], // none: the crow is off-stage at s10 (AD1 section f)
  s11: [
    perch('lampTop', 3104, 112), perch('boothRoof', 3050, 102), perch('clockTop', 2890, 88), { id: 'groundDog', x: 2924, y: GROUND_Y + 32 },
  ],
  s15: [perch('lampTop', 3104, 112), perch('boothRoof', 3050, 102)],
};

// The crow's hop between perches (C3): one wing, at most maxDistPx long, the apex at most apexMaxPx above the higher end (apexPerDist of the
// distance plus apexAddPx), never over the machine x-range and never off the stage. The frames: fly0 for fly0Ms, then the fly frames at
// flyFps; it lands on the perch frames, each landMs. The arc is pure maths (crowHopSpec, crowArcY in src/game/math/pokeRender.ts) and is
// drawn by LivingWorld.crowHop.
export const CROW_HOP = {
  pxPerS: 160, minMs: 450, maxDistPx: 160, apexMaxPx: 48, apexPerDist: 0.35, apexAddPx: 16, flyFrames: ['fly0', 'fly1', 'fly2'],
  fly0Ms: 100, flyFps: 12, landFrames: ['perch0', 'ruffle'], landMs: 300,
} as const;
// The machine's visible x-range per framing (world px: the outer base feet on the object side, AD1 hand-off section d). A crow hop's arc never
// crosses it (crowHopSpec).
export const CROW_MACHINE_X: Partial<Record<FramingKey, { readonly left: number; readonly right: number }>> = {
  e1: { left: 1576, right: 2316 }, s8: { left: 1576, right: 2552 }, s8w: { left: 1576, right: 2648 }, s9: { left: 1576, right: 2808 },
  s10: { left: 1302, right: 2808 }, s11: { left: 1036, right: 2808 }, s15: { left: 848, right: 2992 },
};

// The render side of the answers (WP28a T15b1): the clock's minute twitch, the booth hood's blinks (hoodBlinks blinks, each lit and then dark
// for hoodBlinkMs) and the Sensor 7 pointer rule (the pointer counts as moved for pointerFreshMs; the head changes at most once per
// pointerChangeGapMs, four changes a second), and the Sensor 7 solid LED (ledSolidMs) after its lens glint (lensGlintMs). Every answer lasts at
// most POKES.maxAnswerMs. lantern: the girl's lantern ring (lanternRing, a poke answer): its center (world px from her feet), stroke, radius
// r0 to r1 over the answer, peak alpha, the steady reduced-motion ring (radius, alpha, at most reducedMs) and the depth step that sits it just
// above her body.
export const POKE_RENDER = {
  clockTwitchMs: 300, hoodBlinks: 3, hoodBlinkMs: 150, pointerFreshMs: 3000, pointerChangeGapMs: 250, ledSolidMs: 3000, lensGlintMs: 150,
  lantern: { dx: -11, dy: -14, color: 0xffd27a, width: 2, r0: 5, r1: 9, alpha: 0.7, reducedR: 7, reducedAlpha: 0.5, reducedMs: 1200, depthStep: 0.001 },
} as const;
