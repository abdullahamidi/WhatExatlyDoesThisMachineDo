// WP22 part evolution tiers, pure maths (docs/plan/WP22.md C3, PART_TIERS §1.2 / §3.2). A tier is a pure function of the tech levels:
// rendering only, no save field, no simulation change. resolveTextureKey is the one texture-key chooser (D3); restoredTextures delegates here.
// Pure: no Phaser, no DOM. The numbers and strings live in src/data/machineTiers.ts; this file does the arithmetic and key choice only.

import type { AssetId } from '../../assets/assetIds';
import { ASSET_MANIFEST, planAssetLoads, restoredTextureKey, ROT_SUFFIX, tierTextureKey } from '../../assets/manifest';
import type { AssetEntry } from '../../assets/manifest';
import { MACHINE_COMPONENTS } from '../../data/machineComponents';
import type { MachineComponentId } from '../../data/machineComponents';
import { PART_TIERS, PART_TIER_FX, TIER_HEARTBEAT, TIER_MARKS, TIER_NAMES_3, TIER_NAMES_5, TIER_TEXT } from '../../data/machineTiers';
import type { PartTierTrack, TierDebrisKind } from '../../data/machineTiers';
import type { TechId } from '../../data/types';

/** Debris kind of one tier step (rust, scale, spark, mote). */
export type TierDebris = TierDebrisKind;

/** One tier change of one track: the unit the beat, the cap and the toasts count (WP22 D6 / D7). */
export interface TierChange {
  techId: TechId;
  from: number;
  to: number;
  top: number;
  hosts: readonly MachineComponentId[];
  debris: TierDebris;
  staged: boolean;
}

/** Inputs of the texture key choice (D3). */
export interface TierKeyState {
  tier: number;
  restored: boolean;
  rot: boolean;
  pulseLow: boolean;
}

type TierFile = NonNullable<AssetEntry['tiers']>[number];

const TRACK_BY_TECH: ReadonlyMap<TechId, PartTierTrack> = new Map<TechId, PartTierTrack>(
  PART_TIERS.map((track): [TechId, PartTierTrack] => [track.techId, track]),
);

/** Debris per step of a 5-tier track: I to II rust, II to III scale, III to IV spark, IV to V mote. */
const DEBRIS_5: readonly TierDebris[] = ['rust', 'scale', 'spark', 'mote'];
/** Debris per step of a 3-tier track: I to II rust, II to III mote. */
const DEBRIS_3: readonly TierDebris[] = ['rust', 'mote'];

/** Tier of a level: the number of thresholds <= level, at least 1 and at most levels.length. Non-finite or below 1 is tier 1. */
export function tierOf(level: number, levels: readonly number[]): number {
  if (!Number.isFinite(level) || level < 1) return 1;
  let reached = 0;
  for (const threshold of levels) {
    if (threshold <= level) reached++;
  }
  return Math.max(1, Math.min(reached, levels.length));
}

/** The top tier of a track: its tier count (3 or 5). */
export function topTierOf(track: PartTierTrack): number {
  return track.levels.length;
}

/** The repeatable part track of a tech, or undefined (horizonField and every non-part tech). */
export function trackOf(techId: TechId): PartTierTrack | undefined {
  return TRACK_BY_TECH.get(techId);
}

/** Tier of every track, one entry per track in track order. A missing level reads 0, so tier 1. */
export function partTierMap(
  levels: Readonly<Partial<Record<TechId, number>>>,
  tracks: readonly PartTierTrack[] = PART_TIERS,
): Readonly<Partial<Record<TechId, number>>> {
  const out: Partial<Record<TechId, number>> = {};
  for (const track of tracks) {
    out[track.techId] = tierOf(levels[track.techId] ?? 0, track.levels);
  }
  return out;
}

/** Tier of every SWAP host (stage hosts are not swap hosts and get no entry). */
export function hostTiers(
  levels: Readonly<Partial<Record<TechId, number>>>,
  tracks: readonly PartTierTrack[] = PART_TIERS,
): ReadonlyMap<MachineComponentId, number> {
  const out = new Map<MachineComponentId, number>();
  for (const track of tracks) {
    const tier = tierOf(levels[track.techId] ?? 0, track.levels);
    for (const host of track.swaps) {
      out.set(host, tier);
    }
  }
  return out;
}

const DECLARED_CACHE = new WeakMap<Record<AssetId, AssetEntry>, ReadonlySet<string>>();

/** Every texture key the manifest declares (the planAssetLoads keys), cached per manifest object. */
export function declaredKeys(manifest: Record<AssetId, AssetEntry> = ASSET_MANIFEST): ReadonlySet<string> {
  const cached = DECLARED_CACHE.get(manifest);
  if (cached !== undefined) return cached;
  const keys: ReadonlySet<string> = new Set(planAssetLoads(manifest).map((load) => load.key));
  DECLARED_CACHE.set(manifest, keys);
  return keys;
}

/** One tier's candidate key for the state, or null when that key is not loaded. Rot uses only tiers with a rotation sheet. */
function tierCandidate(assetId: AssetId, tier: TierFile, s: TierKeyState, has: (key: string) => boolean): string | null {
  if (s.rot) {
    if (tier.rotationFile === undefined) return null;
    const rotKey = tierTextureKey(assetId, tier.from, { rot: true });
    return has(rotKey) ? rotKey : null;
  }
  if (s.pulseLow && tier.pulseFile !== undefined) {
    const pulseKey = tierTextureKey(assetId, tier.from, { pulse: true });
    if (has(pulseKey)) return pulseKey;
  }
  const key = tierTextureKey(assetId, tier.from);
  return has(key) ? key : null;
}

/**
 * Texture key of a machine sprite for the state (D3). Precedence: restored variant when asked and loaded; else the highest
 * declared tier `from <= tier` whose key is loaded (sparse and missing variants fall to the next lower tier); else the base key.
 * The rot suffix stays last and is never doubled; rot and pulse never combine.
 */
export function resolveTextureKey(
  assetId: AssetId,
  s: TierKeyState,
  has: (key: string) => boolean,
  manifest: Record<AssetId, AssetEntry> = ASSET_MANIFEST,
): string {
  const entry = manifest[assetId];
  if (s.restored && entry.restored !== undefined) {
    const restoredKey = restoredTextureKey(assetId, s.rot);
    if (has(restoredKey)) return restoredKey;
  }
  const tiers = entry.tiers ?? [];
  for (let i = tiers.length - 1; i >= 0; i--) {
    const tier = tiers[i];
    if (tier === undefined || !(tier.from <= s.tier)) continue;
    const key = tierCandidate(assetId, tier, s, has);
    if (key !== null) return key;
  }
  return s.rot ? assetId + ROT_SUFFIX : assetId;
}

/** Debris kind of the step that reaches tier `step + 1` on a track with `top` tiers. */
function debrisOf(top: number, step: number): TierDebris {
  const kinds = top === 3 ? DEBRIS_3 : DEBRIS_5;
  return kinds[step - 1] ?? 'rust';
}

/** True when the host's resolved texture key differs between the two tiers (no restored, no pulse: a plain tier swap). */
function swapKeyChanged(
  host: MachineComponentId,
  from: number,
  to: number,
  has: (key: string) => boolean,
  manifest: Record<AssetId, AssetEntry>,
): boolean {
  const assetId = MACHINE_COMPONENTS[host].assetId;
  const rot = manifest[assetId].rotation !== undefined;
  const keyAt = (tier: number): string => resolveTextureKey(assetId, { tier, restored: false, rot, pulseLow: false }, has, manifest);
  return keyAt(from) !== keyAt(to);
}

/**
 * Tier changes between two tier maps (from partTierMap; missing = tier 1), increases only, in track order.
 * hosts = swap hosts whose key changes, then the stage hosts that become visible in (from, to] (D4).
 * staged = no swap key changes. debris comes from the last step crossed. A change with no hosts is not reported.
 */
export function diffTiers(
  prev: Readonly<Partial<Record<TechId, number>>>,
  next: Readonly<Partial<Record<TechId, number>>>,
  tracks: readonly PartTierTrack[] = PART_TIERS,
  manifest: Record<AssetId, AssetEntry> = ASSET_MANIFEST,
): TierChange[] {
  const declared = declaredKeys(manifest);
  const has = (key: string): boolean => declared.has(key);
  const changes: TierChange[] = [];
  for (const track of tracks) {
    const from = prev[track.techId] ?? 1;
    const to = next[track.techId] ?? 1;
    if (!(to > from)) continue;
    const swapHosts = track.swaps.filter((host) => swapKeyChanged(host, from, to, has, manifest));
    const stageHosts = (track.stages ?? []).filter((host) => {
      const at = tierOf(MACHINE_COMPONENTS[host].minLevel, track.levels);
      return at > from && at <= to && !swapHosts.includes(host);
    });
    const hosts = [...swapHosts, ...stageHosts];
    if (hosts.length === 0) continue;
    changes.push({
      techId: track.techId,
      from,
      to,
      top: topTierOf(track),
      hosts,
      debris: debrisOf(topTierOf(track), to - 1),
      staged: swapHosts.length === 0,
    });
  }
  return changes;
}

/**
 * Splits one release's changes into the beats that play (the first `max` non-staged changes, in order) and the instant rest.
 * Staged changes are in neither list (they fly in and emit their own signal, D4).
 */
export function splitRelease(
  changes: readonly TierChange[],
  max: number = PART_TIER_FX.maxBeatsPerRelease,
): { beats: TierChange[]; instant: TierChange[] } {
  const beats: TierChange[] = [];
  const instant: TierChange[] = [];
  for (const change of changes) {
    if (change.staged) continue;
    if (beats.length < max) {
      beats.push(change);
    } else {
      instant.push(change);
    }
  }
  return { beats, instant };
}

/** MK V heartbeat phase: true in the second half of each period. Non-finite or negative time, or a non-positive period, is false. */
export function heartbeatLow(nowMs: number, periodMs: number = TIER_HEARTBEAT.periodMs): boolean {
  if (!Number.isFinite(nowMs) || nowMs < 0 || !(periodMs > 0)) return false;
  return Math.floor(nowMs / (periodMs / 2)) % 2 === 1;
}

/** Levels bought inside the current tier (the torque tick pitch step). Level 0 and non-finite levels give 0. */
export function torqueStep(level: number, levels: readonly number[]): number {
  if (!Number.isFinite(level) || level < 1) return 0;
  const tierStart = levels[tierOf(level, levels) - 1] ?? 0;
  return Math.max(0, level - tierStart);
}

/** Fills {name} placeholders of a TIER_TEXT template. */
function fill(template: string, vars: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (whole: string, key: string) => {
    const value = vars[key];
    return value === undefined ? whole : String(value);
  });
}

/** Mark of a 1-based tier: MK I at tier 1. */
function markAt(tier: number): string {
  return TIER_MARKS[tier - 1] ?? TIER_MARKS[0];
}

/** Tier name of a 1-based tier on a track (3-tier and 5-tier ladders). */
function nameAt(track: PartTierTrack, tier: number): string {
  const names = topTierOf(track) === 3 ? TIER_NAMES_3 : TIER_NAMES_5;
  return names[tier - 1] ?? names[0];
}

/**
 * Part-panel suffix of a tech's level line, or null (no track, or level < 1).
 * Below top: ' · MK II — MK III AT 10'. At top: ' · MK V AS BUILT'.
 */
export function tierLevelSuffix(techId: TechId, level: number): string | null {
  const track = trackOf(techId);
  if (track === undefined || !(level >= 1)) return null;
  const tier = tierOf(level, track.levels);
  const nextAt = track.levels[tier];
  if (nextAt !== undefined) {
    return TIER_TEXT.sep + fill(TIER_TEXT.next, { mark: markAt(tier), nextMark: markAt(tier + 1), level: nextAt });
  }
  return TIER_TEXT.sep + fill(TIER_TEXT.top, { mark: markAt(tier), name: nameAt(track, tier) });
}

/** Purchase-toast suffix ' · MK n' (mark of the tier of toLevel) when the purchase crosses a tier, else null. */
export function tierToastSuffix(techId: TechId, fromLevel: number, toLevel: number): string | null {
  const track = trackOf(techId);
  if (track === undefined) return null;
  const fromTier = tierOf(fromLevel, track.levels);
  const toTier = tierOf(toLevel, track.levels);
  if (!(fromTier < toTier)) return null;
  return TIER_TEXT.sep + markAt(toTier);
}
