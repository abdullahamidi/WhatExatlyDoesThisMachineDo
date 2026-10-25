import Phaser from 'phaser';
import type { AssetId } from './assetIds';
import { ASSET_MANIFEST, missingTextureIds, sheetFrameRects } from './manifest';
import type { Painter } from './painters/painterTypes';
import { paintSky, paintMountains, paintSkyline, paintPylons, paintPylonsLit, paintGround, paintDust } from './painters/background';
import { ERA2_PAINTERS } from './painters/era2';
import { LEGACY_PAINTERS } from './painters/legacy';
import { WORLD_PAINTERS } from './painters/world';
import { paintFrame, paintCrank, paintGear } from './painters/machine';
import { paintGenericPlate } from './painters/generic';

const PAINTERS: Partial<Record<AssetId, Painter>> = {
  ...ERA2_PAINTERS,
  ...LEGACY_PAINTERS,
  ...WORLD_PAINTERS,
  'bg.sky': paintSky,
  'bg.mountains': paintMountains,
  'bg.skyline': paintSkyline,
  'bg.pylons': paintPylons,
  'bg.pylonsLit': paintPylonsLit,
  'terrain.ground': paintGround,
  'fx.dust': paintDust,
  'machine.frame': paintFrame,
  'machine.crank': paintCrank,
  'machine.gearSmall': paintGear,
  'machine.gearLarge': paintGear,
  'machine.pulleyMotor': paintGear,
  'machine.pulleyMain': paintGear,
  'machine.pulleyCrank': paintGear,
  'machine.pulleyFlywheel': paintGear,
  'machine.crankBrace': paintGear,
};

// Generates a procedural texture for every manifest id that the scene does not already have.
// Returns the generated ids.
export function ensureFallbackTextures(scene: Phaser.Scene): AssetId[] {
  const missing = missingTextureIds((key) => scene.textures.exists(key));
  const generated: AssetId[] = [];
  for (const id of missing) {
    const entry = ASSET_MANIFEST[id];
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    (PAINTERS[id] ?? paintGenericPlate)(g, entry);
    g.generateTexture(id, entry.width, entry.height);
    g.destroy();
    const texture = scene.textures.get(id);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    sheetFrameRects(entry).forEach((r, i) => texture.add(i, 0, r.x, r.y, r.width, r.height));
    generated.push(id);
  }
  if (generated.length > 0) {
    console.info('[assets] generated fallback textures:', generated.join(', '));
  }
  return generated;
}
