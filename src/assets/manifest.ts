import { ASSET_IDS } from './assetIds';
import type { AssetId } from './assetIds';

export interface AssetEntry {
  id: AssetId;
  file: string | null; // path under public/assets/, null = procedural only
  width: number; // source art px; fallback generated at this size; replacements must match
  height: number;
  origin: { x: number; y: number };
  tileable: 'none' | 'x' | 'xy';
  frame?: { width: number; height: number; count: number };
  description: string;
}

export const ASSET_MANIFEST: Record<AssetId, AssetEntry> = {
  'bg.sky': {
    id: 'bg.sky', file: null, width: 1280, height: 720, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Hazy, desaturated sky with a bright haze band near 65% of the height.',
  },
  'bg.mountains': {
    id: 'bg.mountains', file: 'bg/mountains.png', width: 512, height: 256, origin: { x: 0, y: 1 }, tileable: 'x',
    description: 'Far ridge with distant ruins; tiles horizontally, period = width, ground line at y=156.',
  },
  'bg.skyline': {
    id: 'bg.skyline', file: 'bg/skyline.png', width: 512, height: 320, origin: { x: 0, y: 1 }, tileable: 'x',
    description: 'Ruined city skyline; tiles horizontally, period = width, ground line at y=220.',
  },
  'bg.pylons': {
    id: 'bg.pylons', file: 'bg/pylons.png', width: 256, height: 256, origin: { x: 0, y: 1 }, tileable: 'x',
    description: 'Rusted pylons with sagging wires; tiles horizontally, period = width, ground line at y=156.',
  },
  'terrain.ground': {
    id: 'terrain.ground', file: 'terrain/ground.png', width: 256, height: 128, origin: { x: 0, y: 0 }, tileable: 'xy',
    description: 'Cracked sand ground tile that tiles in both directions.',
  },
  'fx.dust': {
    id: 'fx.dust', file: null, width: 4, height: 4, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Single dust mote particle drifting over the wasteland.',
  },
  'machine.frame': {
    id: 'machine.frame', file: 'machine/support-frame.png', width: 200, height: 110, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Riveted, rusty support frame whose base sits on the ground line.',
  },
  'machine.crank': {
    id: 'machine.crank', file: 'machine/hand-crank.png', width: 48, height: 48, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Hand crank with its hub at the centre; the player clicks it to work the machine.',
  },
  'machine.gearSmall': {
    id: 'machine.gearSmall', file: 'machine/gear-small.png', width: 40, height: 40, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Small toothed gear meshed into the drive train.',
  },
  'machine.gearLarge': {
    id: 'machine.gearLarge', file: 'machine/gear-large.png', width: 64, height: 64, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Large reinforced toothed gear that slows and steadies the drive.',
  },
  'machine.flywheel': {
    id: 'machine.flywheel', file: 'machine/flywheel.png', width: 96, height: 96, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Heavy flywheel that stores momentum for the machine.',
  },
  'machine.motor': {
    id: 'machine.motor', file: 'machine/worn-motor.png', width: 64, height: 48, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Worn electric motor bolted to the frame, shaking as it runs.',
  },
  'machine.bearingPlate': {
    id: 'machine.bearingPlate', file: 'machine/bearing-plate.png', width: 16, height: 16, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Square riveted steel bearing plate with a round bearing housing at its centre.',
  },
  'machine.pulleyMotor': {
    id: 'machine.pulleyMotor', file: 'machine/pulley-motor.png', width: 12, height: 12, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Tiny steel V-pulley seen face-on, with a rim ring and a hub dot.',
  },
  'machine.pulleyMain': {
    id: 'machine.pulleyMain', file: 'machine/pulley-main.png', width: 24, height: 24, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Cast main pulley face-on with a 4-hole web and a raised crank-pin boss at its right side.',
  },
  'machine.pulleyCrank': {
    id: 'machine.pulleyCrank', file: 'machine/pulley-crank.png', width: 32, height: 32, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Flat-belt pulley seen face-on with a crowned rim, five spokes and a hub.',
  },
  'machine.pulleyFlywheel': {
    id: 'machine.pulleyFlywheel', file: 'machine/pulley-flywheel.png', width: 28, height: 28, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Hub pulley bolted to the flywheel, seen face-on with four spokes.',
  },
  'machine.pedestal': {
    id: 'machine.pedestal', file: 'machine/flywheel-pedestal.png', width: 48, height: 64, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Cast-iron A-frame bearing stand in side view with a plummer block cap and bolted foot plates.',
  },
  'machine.motorPlinth': {
    id: 'machine.motorPlinth', file: 'machine/motor-plinth.png', width: 48, height: 10, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Low riveted iron skid with four hold-down bolts and sand dust along its top edge.',
  },
  'machine.pistonBlock': {
    id: 'machine.pistonBlock', file: 'machine/piston-block.png', width: 96, height: 58, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Static block of three identical vertical cylinders with capped heads on a foot plate.',
  },
  'machine.pistonYoke': {
    id: 'machine.pistonYoke', file: 'machine/piston-yoke.png', width: 80, height: 16, origin: { x: 0.5, y: 0.75 }, tileable: 'none',
    description: 'Horizontal steel crosshead bar with a centre pin eye and three plunger rods rising from it.',
  },
  'fx.steam': {
    id: 'fx.steam', file: 'fx/steam.png', width: 16, height: 16, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Steam puff particle released by working pistons.',
  },
};

export interface AssetLoad {
  key: AssetId;
  url: string;
  kind: 'image' | 'spritesheet';
  frame?: AssetEntry['frame'];
}

/** Returns the URL for a file-backed entry (baseUrl + file), or null for procedural-only entries. */
export function resolveAssetUrl(entry: AssetEntry, baseUrl: string = 'assets/'): string | null {
  return entry.file === null ? null : baseUrl + entry.file;
}

/** Lists load descriptors in ASSET_IDS order for every file-backed entry (kind = spritesheet iff frame). */
export function planAssetLoads(
  manifest: Record<AssetId, AssetEntry> = ASSET_MANIFEST,
  baseUrl: string = 'assets/',
): AssetLoad[] {
  const loads: AssetLoad[] = [];
  for (const id of ASSET_IDS) {
    const entry = manifest[id];
    const url = resolveAssetUrl(entry, baseUrl);
    if (url === null) continue;
    const load: AssetLoad = { key: id, url, kind: entry.frame ? 'spritesheet' : 'image' };
    if (entry.frame !== undefined) load.frame = entry.frame;
    loads.push(load);
  }
  return loads;
}

/** Returns the ids for which has(id) is false, in the order given. */
export function missingTextureIds(has: (key: string) => boolean, ids: readonly AssetId[] = ASSET_IDS): AssetId[] {
  return ids.filter((id) => !has(id));
}
