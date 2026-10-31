// Poke ladder (WP28a T15a): the pure maths of the world pokes. A poke within POKES.minGapMs of the target's last accepted poke is ignored
// (null, no sound). The level is the number of pokes on the target inside the last POKES.windowMs: 1-2 is level 1 (a pick from the level-1
// bag), 3 is level 2 (the level-2 clip, or a level-1 pick when that clip was the last reaction), 4 or more is level 3 (the level-3 clip, or a
// level-1 pick when that clip was the last reaction, plus the leave id) and the target is unavailable for POKES.unavailableMs: its pokes then
// alternate the two wordless answers, never the same twice in a row. The count starts again after POKES.resetMs without a poke. A bag pick
// avoids the bag's last two picks and never repeats the target's previous reaction (across the levels and the unavailable window).
// Deterministic from the seed: a sine hash of the seed and the draw count (the hash01 law of worldBehaviour.ts, copied here so the poke maths
// imports no runner code). Nothing draws from Math.random. Pure: no Phaser, no DOM. Every number lives in src/data/pokes.ts.
import { POKES, POKE_BUBBLE, POKE_OBJECT_KEY, POKE_OBJECT_TABLES, POKE_TABLES } from '../../data/pokes';
import type { PokeClip, PokeSoundId, PokeTable, PokeTargetKey } from '../../data/pokes';
import type { WorldVoices } from '../../data/types';

// One answer of the ladder: its level, whether it is the unavailable window, the clip, the leave activity (level 3 only), the sound (null:
// silent) and the delay before the answer starts (300-500 ms).
export interface PokeResult {
  level: 1 | 2 | 3;
  unavailable: boolean;
  clip: PokeClip;
  leave: string | null;
  sound: PokeSoundId | null;
  delayMs: number;
}
// Per target: the accepted poke times inside the window, the last accepted poke, the end of the unavailable window and the last reaction id.
interface TargetState { times: number[]; lastMs: number; unavailableUntil: number; lastId: string | null }
// Per bag (a target and an era): the last picks.
interface BagState { recent: string[] }
export interface PokeLadder { seed: number; draws: number; targets: Map<string, TargetState>; bags: Map<string, BagState> }

// Salt of the bag picks (the draw counter follows it).
const BAG_SALT = 811;

// Sine hash of two numbers in [0, 1): deterministic, no random source.
function hash01(a: number, b: number): number {
  const f = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return f - Math.floor(f);
}

// A fresh ladder for one seed: no pokes, no bags, no draws.
export function createPokeLadder(seed: number): PokeLadder {
  return { seed, draws: 0, targets: new Map(), bags: new Map() };
}

// Clears the counts and the unavailable windows of every target. The bags keep their recent picks, and each target keeps its last reaction
// id, so the first answer after a reset still differs from the one before it.
export function resetLadder(l: PokeLadder): void {
  for (const st of l.targets.values()) {
    st.times.length = 0;
    st.lastMs = -Infinity;
    st.unavailableUntil = -Infinity;
  }
}

// Whether the target is in its unavailable window at nowMs (the wordless answers alternate).
export function isUnavailable(l: PokeLadder, targetKey: string, nowMs: number): boolean {
  return (l.targets.get(targetKey)?.unavailableUntil ?? -Infinity) > nowMs;
}

// A number from a string key (the target key), so the answer delay differs by target. Integer maths, deterministic.
function keyHash(key: string): number {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 1000003;
  return h;
}

// Whether a key is one of the poke tables (the own keys of POKE_TABLES only).
function isPokeKey(key: string): key is PokeTargetKey {
  return Object.hasOwn(POKE_TABLES, key);
}
// The table of a target key at an era (undefined for an unknown key or era). An object key ('object:<id>') reads the object's own table when it
// has one, else the 'object' table; any other key reads its own table.
function tableOf(targetKey: string, era: number): PokeTable | undefined {
  if (targetKey.startsWith(POKE_OBJECT_KEY)) {
    const id = targetKey.slice(POKE_OBJECT_KEY.length);
    return (Object.hasOwn(POKE_OBJECT_TABLES, id) ? POKE_OBJECT_TABLES[id] : POKE_TABLES.object)?.[era - 1];
  }
  return isPokeKey(targetKey) ? POKE_TABLES[targetKey][era - 1] : undefined;
}

function targetOf(l: PokeLadder, targetKey: string): TargetState {
  const st = l.targets.get(targetKey) ?? { times: [], lastMs: -Infinity, unavailableUntil: -Infinity, lastId: null };
  l.targets.set(targetKey, st);
  return st;
}

// The next level-1 pick of a bag: the clips that are neither among the bag's last picks nor the previous reaction; when none is left, the
// clips other than the previous reaction; when none is left, the whole bag (a bag of one). Returns undefined only for an empty bag.
function bagPick(l: PokeLadder, bagKey: string, bag: readonly PokeClip[], avoid: string | null): PokeClip | undefined {
  const bs = l.bags.get(bagKey) ?? { recent: [] };
  l.bags.set(bagKey, bs);
  const recent = bs.recent;
  const fresh = bag.filter((c) => !recent.includes(c.id) && c.id !== avoid);
  const notPrev = bag.filter((c) => c.id !== avoid);
  const pool = [fresh, notPrev].find((p) => p.length > 0) ?? bag;
  const u = hash01(l.seed + BAG_SALT, l.draws);
  l.draws += 1;
  const chosen = pool[Math.min(pool.length - 1, Math.floor(u * pool.length))];
  if (chosen !== undefined) bs.recent = [...recent, chosen.id].slice(-POKES.bagAvoid);
  return chosen;
}

// One ladder answer; its sound is the clip's own.
const answer = (level: 1 | 2 | 3, unavailable: boolean, clip: PokeClip, leave: string | null, delayMs: number): PokeResult => ({
  level, unavailable, clip, leave, sound: clip.sound, delayMs,
});

// The answer to a poke on a target at nowMs in an era, or null when the poke is ignored (within minGapMs of the last accepted one, an
// unknown target, or an era with no table). An accepted poke changes the counts only; nothing here touches the economy.
export function pokeOn(l: PokeLadder, targetKey: string, era: number, nowMs: number): PokeResult | null {
  if (!Number.isInteger(era) || era < 1) return null;
  const table = tableOf(targetKey, era);
  if (table === undefined) return null;
  const st = targetOf(l, targetKey);
  if (nowMs - st.lastMs < POKES.minGapMs) return null;
  if (nowMs - st.lastMs >= POKES.resetMs) st.times.length = 0;
  st.lastMs = nowMs;
  st.times.push(nowMs);
  while (st.times.length > 0 && (st.times[0] ?? nowMs) < nowMs - POKES.windowMs) st.times.shift();
  const count = st.times.length;
  const delayMs = POKES.answerDelayMs[0] + hash01(keyHash(targetKey), count) * (POKES.answerDelayMs[1] - POKES.answerDelayMs[0]);
  if (nowMs < st.unavailableUntil) {
    // The wordless answer that differs from the last reaction (the first one when the last reaction is neither).
    const [first, second] = table.unavailable;
    const clip = st.lastId === first.id ? second : first;
    st.lastId = clip.id;
    return answer(3, true, clip, null, delayMs);
  }
  if (count >= POKES.levelThreeAt) {
    st.unavailableUntil = nowMs + POKES.unavailableMs;
    // D4: the level-3 clip never answers twice in a row (a table whose level 2 and level 3 share a clip): then a level-1 pick answers, and
    // the leave stays.
    const pick = st.lastId === table.l3.id ? bagPick(l, `${targetKey}|${era}`, table.l1, st.lastId) : undefined;
    const clip = pick ?? table.l3;
    st.lastId = clip.id;
    return answer(3, false, clip, table.leave, delayMs);
  }
  // Level 2 is the level-2 clip, except that it never answers twice in a row (B4, D4): then a level-1 pick answers instead.
  const level = count >= POKES.levelTwoAt ? 2 : 1;
  const clip = level === 2 && st.lastId !== table.l2.id ? table.l2 : bagPick(l, `${targetKey}|${era}`, table.l1, st.lastId);
  if (clip === undefined) return null;
  st.lastId = clip.id;
  return answer(level, false, clip, null, delayMs);
}

// The reduced-motion form of an answer (WP28 Pokes): one held frame, the longest one of the clip, for at most POKES.reducedHoldMs; the sound
// stays. A light-only answer keeps its light for at most the same time. Never longer than the clip.
export function reducedClip(clip: PokeClip): PokeClip {
  const durMs = Math.min(clip.durMs, POKES.reducedHoldMs);
  const best = clip.frameMs.reduce((b, ms, i) => (ms > (clip.frameMs[b] ?? 0) ? i : b), 0);
  const held = clip.frames[best];
  if (held === undefined) return { ...clip, frames: [], frameMs: [], durMs };
  return { ...clip, frames: [held], frameMs: [durMs], durMs };
}

// The poke bubbles (WP28b, P12): the rule and its state. The state keeps each actor's last shown bubble and the shown times of the last hour
// (oldest first). Neither bubble counts against the era voice caps: nothing here touches the scheduler.
export type PokeBubbleActor = 'inspector' | 'girl';
export interface PokeBubbleState { lastAtMs: Record<'inspector' | 'girl', number>; hourStamps: number[] }

// A fresh state: no bubble shown yet, no stamps.
export function createPokeBubbleState(): PokeBubbleState {
  return { lastAtMs: { inspector: -Infinity, girl: -Infinity }, hourStamps: [] };
}

// The bubbles shown inside the last hour at nowMs (a stamp counts while it is less than hourMs old).
function stampsInHour(s: PokeBubbleState, nowMs: number): number {
  let n = 0;
  for (const t of s.hourStamps) if (nowMs - t < POKE_BUBBLE.hourMs) n += 1;
  return n;
}

// Whether the actor's bubble may start at nowMs. u01 is a draw in [0, 1) from the caller. Pure: the state is read only. Off is never; a line
// bubble up blocks; the actor's gap and the hour's cap (across both actors) block; then the draw against the chance (RARE: the lower one).
export function pokeBubbleDue(s: PokeBubbleState, actor: PokeBubbleActor, nowMs: number, u01: number,
  opts: { voices: WorldVoices; lineBubbleUp: boolean }): boolean {
  if (opts.voices === 'off' || opts.lineBubbleUp) return false;
  if (nowMs - s.lastAtMs[actor] < POKE_BUBBLE.perActorGapMs) return false;
  if (stampsInHour(s, nowMs) >= POKE_BUBBLE.perHourMax) return false;
  return u01 < (opts.voices === 'rare' ? POKE_BUBBLE.chanceRare : POKE_BUBBLE.chance);
}

// Records a bubble that starts at nowMs. Stamps an hour or more old are dropped, so the list holds the shown times of the last hour only.
export function notePokeBubble(s: PokeBubbleState, actor: PokeBubbleActor, nowMs: number): void {
  s.lastAtMs[actor] = nowMs;
  let drop = 0;
  while (drop < s.hourStamps.length && nowMs - (s.hourStamps[drop] ?? nowMs) >= POKE_BUBBLE.hourMs) drop += 1;
  if (drop > 0) s.hourStamps.splice(0, drop);
  s.hourStamps.push(nowMs);
}
