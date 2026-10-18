export const ASSET_IDS = ['bg.sky','bg.mountains','bg.skyline','bg.pylons','terrain.ground','fx.dust',
  'machine.frame','machine.crank','machine.gearSmall','machine.gearLarge','machine.flywheel',
  'machine.motor','machine.piston','fx.steam'] as const;
export type AssetId = typeof ASSET_IDS[number];
