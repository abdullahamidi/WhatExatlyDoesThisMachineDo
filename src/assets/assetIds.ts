export const ASSET_IDS = ['bg.sky','bg.mountains','bg.skyline','bg.pylons','terrain.ground','fx.dust',
  'machine.frame','machine.crank','machine.gearSmall','machine.gearLarge','machine.flywheel',
  'machine.motor','machine.bearingPlate','machine.pulleyMotor','machine.pulleyMain',
  'machine.pulleyCrank','machine.pulleyFlywheel','machine.pedestal','machine.motorPlinth',
  'machine.pistonBlock','machine.pistonYoke','machine.crankBrace','fx.steam',
  'bg.pylonsLit','machine.generatorPlinth','machine.generator','machine.pulleyGenerator','machine.coils1','machine.coils2','machine.coils3',
  'machine.motorRetrofit','machine.dynamo','machine.capacitorRack','machine.sparkGap','machine.transformer','machine.cableMast',
  'machine.boiler','machine.chimney','machine.steamManifold','machine.gauge','machine.gaugeNeedle',
  'machine.fireGlow1','machine.fireGlow2','machine.fireGlow3','machine.inductionHeater','machine.superheater','machine.reliefValves','machine.steamHammer','machine.hammerRam',
  'machine.condenser','machine.turbine','machine.turbineRotor','fx.steamPuff','fx.smoke',
  'machine.spireTower','machine.spireExciter','machine.spireWave','machine.coilRing1','machine.coilRing2','machine.coilRing3','machine.coilRing4',
  'machine.calliope','machine.servoBase','machine.servoArm','machine.koenigFork','machine.emitterDish','machine.dishWaves','machine.crystal'] as const;
export type AssetId = typeof ASSET_IDS[number];
