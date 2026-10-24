// WP22 tier release planner (docs/plan/WP22.md D4, D6, D7, D9; C4 view part). Pure: no Phaser, no DOM. It decides, the view executes.
// One release = the levels at the last baseline (prevLevels) against the current display levels (nextLevels). The plan lists:
// beats (FX on a settled primary host, capped per release), instant swaps (no beat: with a primary they carry debris there, without
// one the part is still flying in), staged changes (fly-in only, D4) and torque ticks (levels bought inside a tier, D9).
// Tier maths and the change list come from partTiers.ts; the numbers and strings live in src/data/machineTiers.ts.

import type { AssetId } from '../../assets/assetIds';
import type { AssetEntry } from '../../assets/manifest';
import type { MachineComponentId } from '../../data/machineComponents';
import { PART_TIERS, PART_TIER_FX } from '../../data/machineTiers';
import type { PartTierTrack } from '../../data/machineTiers';
import type { TechId } from '../../data/types';
import { diffTiers, partTierMap, splitRelease, tierOf, torqueStep } from './partTiers';
import type { TierChange } from './partTiers';

/** One release as the view sees it (WP22 C4). Levels missing from a record read 0. */
export interface TierReleaseInput {
  /** Levels at the last baseline. */
  prevLevels: Readonly<Partial<Record<TechId, number>>>;
  /** Current display levels. */
  nextLevels: Readonly<Partial<Record<TechId, number>>>;
  /** Limit the plan to these tracks; omitted = every track. */
  techs?: readonly TechId[];
  /** Sprite visible (a fly-in counts). Torque hosts need only this. */
  visible(host: MachineComponentId): boolean;
  /** Visible and fly-in finished: can carry a beat. */
  settled(host: MachineComponentId): boolean;
  /** Track list; omitted = PART_TIERS. */
  tracks?: readonly PartTierTrack[];
  /** Asset manifest; omitted = the real manifest. */
  manifest?: Record<AssetId, AssetEntry>;
  /** Beat cap per release; omitted = PART_TIER_FX.maxBeatsPerRelease. */
  max?: number;
}

/** A change that plays a tier-up beat on its primary host (D7). */
export interface PlannedBeat {
  change: TierChange;
  primary: MachineComponentId;
}

/** A change applied at once: with a primary it swaps there with debris (over the cap); with none the part is still flying in. */
export interface PlannedInstant {
  change: TierChange;
  primary: MachineComponentId | null;
}

/** One torque tick on a host (D9): the levels bought inside the current tier. */
export interface PlannedTorque {
  techId: TechId;
  host: MachineComponentId;
  step: number;
}

/** What the view does for one release, in track order inside each list. */
export interface TierReleasePlan {
  beats: PlannedBeat[];
  instant: PlannedInstant[];
  staged: TierChange[];
  torques: PlannedTorque[];
}

/** The first swap host of the track that is in the change and settled, or null (the part still flies in or is absent). */
function primaryOf(track: PartTierTrack, change: TierChange, settled: (host: MachineComponentId) => boolean): MachineComponentId | null {
  for (const host of track.swaps) {
    if (change.hosts.includes(host) && settled(host)) return host;
  }
  return null;
}

/** Torque host (D9): the first visible swap host, else the first visible stage host; null when none is visible. */
function torqueHostOf(track: PartTierTrack, visible: (host: MachineComponentId) => boolean): MachineComponentId | null {
  const swap = track.swaps.find((host) => visible(host));
  if (swap !== undefined) return swap;
  const stage = (track.stages ?? []).find((host) => visible(host));
  return stage ?? null;
}

/**
 * The plan of one release. Staged changes (no swap key changes) go to `staged` only. Every other change needs a settled swap host as
 * primary; without one it swaps instantly with primary null. The primary changes go through splitRelease (cap per release): the first
 * ones play beats, the rest swap instantly with their primary. A track whose tier did not change and whose level rose (and was >= 1
 * before, so a brand-new part belongs to its fly-in) gets one torque tick on its first visible host.
 */
export function planTierRelease(input: TierReleaseInput): TierReleasePlan {
  const tracks = (input.tracks ?? PART_TIERS).filter((track) => input.techs === undefined || input.techs.includes(track.techId));
  const changes = diffTiers(partTierMap(input.prevLevels, tracks), partTierMap(input.nextLevels, tracks), tracks, input.manifest);

  const staged: TierChange[] = [];
  const pending: PlannedInstant[] = [];
  for (const change of changes) {
    if (change.staged) {
      staged.push(change);
      continue;
    }
    const track = tracks.find((t) => t.techId === change.techId);
    const primary = track === undefined ? null : primaryOf(track, change, (host) => input.settled(host));
    pending.push({ change, primary });
  }

  const withPrimary = pending.flatMap((entry) => (entry.primary === null ? [] : [entry.change]));
  const played = new Set<TierChange>(splitRelease(withPrimary, input.max ?? PART_TIER_FX.maxBeatsPerRelease).beats);

  const beats: PlannedBeat[] = [];
  const instant: PlannedInstant[] = [];
  for (const entry of pending) {
    if (entry.primary === null) {
      instant.push({ change: entry.change, primary: null });
    } else if (played.has(entry.change)) {
      beats.push({ change: entry.change, primary: entry.primary });
    } else {
      instant.push({ change: entry.change, primary: entry.primary });
    }
  }

  const torques: PlannedTorque[] = [];
  for (const track of tracks) {
    const prevLevel = input.prevLevels[track.techId] ?? 0;
    const nextLevel = input.nextLevels[track.techId] ?? 0;
    if (!(prevLevel >= 1) || !(nextLevel > prevLevel)) continue;
    if (tierOf(nextLevel, track.levels) !== tierOf(prevLevel, track.levels)) continue;
    const host = torqueHostOf(track, (h) => input.visible(h));
    if (host === null) continue;
    torques.push({ techId: track.techId, host, step: torqueStep(nextLevel, track.levels) });
  }

  return { beats, instant, staged, torques };
}
