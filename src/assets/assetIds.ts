export const ASSET_IDS = ['bg.sky','bg.mountains','bg.skyline','bg.pylons','terrain.ground','fx.dust',
  'machine.frame','machine.crank','machine.gearSmall','machine.gearLarge','machine.flywheel',
  'machine.motor','machine.bearingPlate','machine.pulleyMotor','machine.pulleyMain',
  'machine.pulleyCrank','machine.pulleyFlywheel','machine.pedestal','machine.motorPlinth',
  'machine.pistonBlock','machine.pistonYoke','fx.steam'] as const;
export type AssetId = typeof ASSET_IDS[number];
