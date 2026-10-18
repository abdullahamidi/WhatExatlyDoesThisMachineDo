export const ASSET_IDS = ['bg.sky','bg.mountains','bg.skyline','bg.pylons','terrain.ground','fx.dust',
  'machine.frame','machine.crank','machine.gearSmall','machine.gearLarge','machine.flywheel',
  'machine.motor','machine.bearingPlate','machine.pulleyMotor','machine.pulleyMain',
  'machine.pulleyCrank','machine.pulleyFlywheel','machine.pedestal','machine.motorPlinth',
  'machine.pistonBlock','machine.pistonYoke','machine.crankBrace','fx.steam',
  'bg.pylonsLit','machine.generatorPlinth','machine.generator','machine.pulleyGenerator','machine.coils1','machine.coils2','machine.coils3',
  'machine.motorRetrofit','machine.dynamo','machine.capacitorRack','machine.sparkGap','machine.transformer','machine.cableMast'] as const;
export type AssetId = typeof ASSET_IDS[number];
