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
  /** Era-variant sheets: frame rows are the era variants I, II, III, IV, V, whole; height = frame.height * eraRows. */
  eraRows?: number;
  /** Pre-rendered rotation sheet (RotSprite frames, grid layout, frame size = width x height). Loaded as `${id}#rot`. */
  rotation?: { file: string; frames: number }; // file under public/assets/
  /** Postgame restored-accent variant (A17 art, wired WP18b): same width/height, frame layout and rotation layout as the original.
   *  Loaded as `${id}#restored` (same kind + frame as the entry) and, with rotationFile, `${id}#restored#rot` (frame = entry.width x entry.height, count = rotation.frames). Paths under public/assets/. */
  restored?: { file: string; rotationFile?: string };
  description: string;
}

export const ROT_SUFFIX = '#rot';
export const RESTORED_SUFFIX = '#restored';
/** `${id}#restored`, or `${id}#restored#rot` when rotation is true. */
export function restoredTextureKey(id: AssetId, rotation: boolean): string {
  return id + RESTORED_SUFFIX + (rotation ? ROT_SUFFIX : '');
}

export const ASSET_MANIFEST: Record<AssetId, AssetEntry> = {
  'bg.sky': {
    id: 'bg.sky', file: 'bg/sky.png', width: 1280, height: 720, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Dusty sky in the four sky palette tones as hard stepped strata, pale sun disc upper-left (light direction); screen-fixed, shown at 2x.',
  },
  'bg.mountains': {
    id: 'bg.mountains', file: 'bg/mountains.png', width: 512, height: 256, origin: { x: 0, y: 1 }, tileable: 'x',
    description: 'Far ridge with distant ruins; tiles horizontally, period = width, ground line at y=156; rows 156-255 far-plain ramp (bottom rows #5f5244 = layer underfill).',
  },
  'bg.skyline': {
    id: 'bg.skyline', file: 'bg/skyline.png', width: 512, height: 320, origin: { x: 0, y: 1 }, tileable: 'x',
    description: 'Ruined city skyline; tiles horizontally, period = width, ground line at y=220; rows 220-319 transparent (layer underfill null).',
  },
  'bg.pylons': {
    id: 'bg.pylons', file: 'bg/pylons.png', width: 256, height: 256, origin: { x: 0, y: 1 }, tileable: 'x',
    description: 'Rusted pylons with sagging wires; tiles horizontally, period = width, ground line at y=156.',
  },
  'bg.pylonsLit': {
    id: 'bg.pylonsLit', file: 'bg/pylons-lit.png', width: 256, height: 256, origin: { x: 0, y: 1 }, tileable: 'x',
    description: 'Pylons with their wires lit; the same tiling as bg.pylons, shown once the power lines are running.',
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
    rotation: { file: 'machine/rot/hand-crank-rot.png', frames: 80 },
    description: 'Hand crank with its hub at the centre; the player clicks it to work the machine.',
  },
  'machine.gearSmall': {
    id: 'machine.gearSmall', file: 'machine/gear-small.png', width: 40, height: 40, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    rotation: { file: 'machine/rot/gear-small-rot.png', frames: 80 },
    description: 'Small toothed gear meshed into the drive train.',
  },
  'machine.gearLarge': {
    id: 'machine.gearLarge', file: 'machine/gear-large.png', width: 64, height: 64, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    rotation: { file: 'machine/rot/gear-large-rot.png', frames: 140 },
    description: 'Large reinforced toothed gear that slows and steadies the drive.',
  },
  'machine.flywheel': {
    id: 'machine.flywheel', file: 'machine/flywheel.png', width: 96, height: 96, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    rotation: { file: 'machine/rot/flywheel-rot.png', frames: 180 },
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
    rotation: { file: 'machine/rot/pulley-motor-rot.png', frames: 24 },
    description: 'Tiny steel V-pulley seen face-on, with a rim ring and a hub dot.',
  },
  'machine.pulleyMain': {
    id: 'machine.pulleyMain', file: 'machine/pulley-main.png', width: 24, height: 24, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    rotation: { file: 'machine/rot/pulley-main-rot.png', frames: 140 },
    description: 'Cast main pulley face-on with a 4-hole web and a raised crank-pin boss at its right side.',
  },
  'machine.pulleyCrank': {
    id: 'machine.pulleyCrank', file: 'machine/pulley-crank.png', width: 32, height: 32, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    rotation: { file: 'machine/rot/pulley-crank-rot.png', frames: 80 },
    description: 'Small flat-belt pulley (r8, centred in a 32×32 canvas) with crowned rim and solid three-rib web; belt rides inside the pinion root.',
  },
  'machine.pulleyFlywheel': {
    id: 'machine.pulleyFlywheel', file: 'machine/pulley-flywheel.png', width: 28, height: 28, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    rotation: { file: 'machine/rot/pulley-flywheel-rot.png', frames: 180 },
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
  'machine.crankBrace': {
    id: 'machine.crankBrace', file: 'machine/crank-brace.png', width: 48, height: 48, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    rotation: { file: 'machine/rot/crank-brace-rot.png', frames: 80 },
    description: 'Riveted doubler strap and bolted boss flange that overlay the hand crank.',
  },
  'fx.steam': {
    id: 'fx.steam', file: 'fx/steam.png', width: 16, height: 16, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Steam puff particle released by working pistons.',
  },
  'machine.generatorPlinth': {
    id: 'machine.generatorPlinth', file: 'machine/era2/generator-plinth.png', width: 104, height: 10, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Cast bedplate with a tension-screw slot that the generator set stands on.',
  },
  'machine.generator': {
    id: 'machine.generator', file: 'machine/era2/generator.png', width: 96, height: 64, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Generator body with a coil housing, a shaft end and a cable terminal on the right.',
  },
  'machine.pulleyGenerator': {
    id: 'machine.pulleyGenerator', file: 'machine/era2/pulley-generator.png', width: 20, height: 20, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    rotation: { file: 'machine/era2/rot/pulley-generator-rot.png', frames: 80 },
    description: 'Generator belt pulley seen face-on, with a rim, spokes and a hub.',
  },
  'machine.coils1': {
    id: 'machine.coils1', file: 'machine/era2/coils-1.png', width: 64, height: 40, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'First coil stage: a single winding of copper wire around the generator frame.',
  },
  'machine.coils2': {
    id: 'machine.coils2', file: 'machine/era2/coils-2.png', width: 64, height: 40, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Second coil stage: a denser copper winding that covers the first stage.',
  },
  'machine.coils3': {
    id: 'machine.coils3', file: 'machine/era2/coils-3.png', width: 64, height: 40, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Third coil stage: a heavy copper winding that covers the lower stages.',
  },
  'machine.motorRetrofit': {
    id: 'machine.motorRetrofit', file: 'machine/era2/motor-retrofit.png', width: 32, height: 16, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Retrofit control box with a wired terminal strip, bolted on top of the worn motor.',
  },
  'machine.dynamo': {
    id: 'machine.dynamo', file: 'machine/era2/dynamo.png', width: 24, height: 24, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Small friction dynamo: a housing with a roller that rides the underside of the crank belt, clamped to the frame.',
  },
  'machine.capacitorRack': {
    id: 'machine.capacitorRack', file: 'machine/era2/capacitor-rack.png', width: 48, height: 64, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Rack of capacitor cans on a steel frame with two lugs on the top plate.',
  },
  'machine.sparkGap': {
    id: 'machine.sparkGap', file: 'machine/era2/spark-gap.png', width: 128, height: 48, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 32, height: 48, count: 4 },
    description: 'Four-frame spark gap sheet: two electrodes with a flickering discharge between them.',
  },
  'machine.transformer': {
    id: 'machine.transformer', file: 'machine/era2/transformer.png', width: 64, height: 64, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Transformer tank with a primary and a bushing lug on its top.',
  },
  'machine.cableMast': {
    id: 'machine.cableMast', file: 'machine/era2/cable-mast.png', width: 16, height: 112, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Tall steel mast with a cable head at the top that carries the line to the pylons.',
  },
  // Era III: boiler, pressure and steam parts (delivered PNGs under machine/era3/).
  'machine.boiler': {
    id: 'machine.boiler', file: 'machine/era3/boiler.png', width: 128, height: 96, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Riveted pressure boiler drum on a cradle, with a steam outlet at the top and a feed port on the left.',
  },
  'machine.chimney': {
    id: 'machine.chimney', file: 'machine/era3/chimney.png', width: 32, height: 160, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Tall riveted smokestack with a flared cap and a collar at its foot.',
  },
  'machine.steamManifold': {
    id: 'machine.steamManifold', file: 'machine/era3/steam-manifold.png', width: 96, height: 14, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Flat steam manifold header with three branch stubs and a port at its left end.',
  },
  'machine.gauge': {
    id: 'machine.gauge', file: 'machine/era3/gauge.png', width: 24, height: 24, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Round pressure gauge dial with a bezel and tick marks, without its needle.',
  },
  'machine.gaugeNeedle': {
    id: 'machine.gaugeNeedle', file: 'machine/era3/gauge-needle.png', width: 600, height: 24, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 24, height: 24, count: 25 },
    description: 'Twenty-five frame sheet of the gauge needle, one needle angle per frame from zero to full scale.',
  },
  'machine.fireGlow1': {
    id: 'machine.fireGlow1', file: 'machine/era3/firebox-1.png', width: 96, height: 24, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    frame: { width: 24, height: 24, count: 4 },
    description: 'Four-frame firebox glow sheet, first stage: a dull ember behind the fire door.',
  },
  'machine.fireGlow2': {
    id: 'machine.fireGlow2', file: 'machine/era3/firebox-2.png', width: 96, height: 24, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    frame: { width: 24, height: 24, count: 4 },
    description: 'Four-frame firebox glow sheet, second stage: a brighter fire behind the fire door.',
  },
  'machine.fireGlow3': {
    id: 'machine.fireGlow3', file: 'machine/era3/firebox-3.png', width: 96, height: 24, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    frame: { width: 24, height: 24, count: 4 },
    description: 'Four-frame firebox glow sheet, third stage: a white-hot fire behind the fire door.',
  },
  'machine.inductionHeater': {
    id: 'machine.inductionHeater', file: 'machine/era3/induction-heater.png', width: 56, height: 40, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Induction heater coil housing on a small plinth with a cable tie on its side.',
  },
  'machine.superheater': {
    id: 'machine.superheater', file: 'machine/era3/superheater.png', width: 40, height: 32, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Superheater drum with a tube bundle and a glowing outlet collar.',
  },
  'machine.reliefValves': {
    id: 'machine.reliefValves', file: 'machine/era3/relief-valves.png', width: 16, height: 24, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Pair of spring-loaded relief valves on a short stand, capped with vent hoods.',
  },
  'machine.steamHammer': {
    id: 'machine.steamHammer', file: 'machine/era3/steam-hammer.png', width: 48, height: 96, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Steam hammer housing with a cylinder, a steam inlet on its side and a guide column below.',
  },
  'machine.hammerRam': {
    id: 'machine.hammerRam', file: 'machine/era3/hammer-ram.png', width: 12, height: 36, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Hammer ram: a short iron piston with a flat striking face at its foot.',
  },
  'machine.condenser': {
    id: 'machine.condenser', file: 'machine/era3/condenser.png', width: 80, height: 24, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Long condenser tank on feet with a condensate port at its right end.',
  },
  'machine.turbine': {
    id: 'machine.turbine', file: 'machine/era3/turbine.png', width: 80, height: 64, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Turbine casing with a steam inlet on the left and an export cable terminal on the right.',
  },
  'machine.turbineRotor': {
    id: 'machine.turbineRotor', file: 'machine/era3/turbine-rotor.png', width: 28, height: 28, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    rotation: { file: 'machine/era3/rot/turbine-rotor-rot.png', frames: 64 },
    description: 'Turbine rotor seen face-on, a bladed wheel on a hub.',
  },
  'fx.steamPuff': {
    id: 'fx.steamPuff', file: 'fx/steam-puff.png', width: 64, height: 16, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    frame: { width: 16, height: 16, count: 4 },
    description: 'Four-frame steam puff sheet, a pale cloud that grows and thins as it rises.',
  },
  'fx.smoke': {
    id: 'fx.smoke', file: 'fx/smoke.png', width: 64, height: 16, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    frame: { width: 16, height: 16, count: 4 },
    description: 'Four-frame dark smoke puff sheet, used for the boiler chimney.',
  },
  // Era IV: resonance spire, coil rings, calliope, servo, fork, dishes and crystal (delivered PNGs under machine/era4/).
  'machine.spireTower': {
    id: 'machine.spireTower', file: 'machine/era4/spire-tower.png', width: 80, height: 320, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Lattice resonator tower on a squat base, tapering to a bare mast at the top.',
  },
  'machine.spireExciter': {
    id: 'machine.spireExciter', file: 'machine/era4/spire-exciter.png', width: 24, height: 32, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Small steam exciter housing on the tower foot with a steam inlet on its left side.',
  },
  'machine.spireWave': {
    id: 'machine.spireWave', file: 'machine/era4/spire-wave.png', width: 128, height: 270, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 16, height: 270, count: 8 },
    description: 'Eight-frame standing wave sheet: a thin vibrating rod shown at one phase per frame.',
  },
  'machine.coilRing1': {
    id: 'machine.coilRing1', file: 'machine/era4/coil-ring-1.png', width: 248, height: 8, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    frame: { width: 62, height: 8, count: 4 },
    description: 'Four-frame toroidal coil ring, widest of the four stacked windings.',
  },
  'machine.coilRing2': {
    id: 'machine.coilRing2', file: 'machine/era4/coil-ring-2.png', width: 192, height: 8, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    frame: { width: 48, height: 8, count: 4 },
    description: 'Four-frame toroidal coil ring, second winding up the tower.',
  },
  'machine.coilRing3': {
    id: 'machine.coilRing3', file: 'machine/era4/coil-ring-3.png', width: 144, height: 8, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    frame: { width: 36, height: 8, count: 4 },
    description: 'Four-frame toroidal coil ring, third winding up the tower.',
  },
  'machine.coilRing4': {
    id: 'machine.coilRing4', file: 'machine/era4/coil-ring-4.png', width: 120, height: 8, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    frame: { width: 30, height: 8, count: 4 },
    description: 'Four-frame toroidal coil ring, narrowest winding at the top of the coil.',
  },
  'machine.calliope': {
    id: 'machine.calliope', file: 'machine/era4/calliope.png', width: 72, height: 40, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Calliope: a row of three steam whistles on a brass-trimmed manifold box.',
  },
  'machine.servoBase': {
    id: 'machine.servoBase', file: 'machine/era4/servo-base.png', width: 28, height: 20, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Low servo gearbox housing with a bolted foot and an empty hub seat on top.',
  },
  'machine.servoArm': {
    id: 'machine.servoArm', file: 'machine/era4/servo-arm.png', width: 48, height: 48, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    rotation: { file: 'machine/era4/rot/servo-arm-rot.png', frames: 80 },
    description: 'Servo arm seen face-on: a hub, a toothed arm and a pin boss that the coupling rod hooks onto.',
  },
  'machine.koenigFork': {
    id: 'machine.koenigFork', file: 'machine/era4/koenig-fork.png', width: 88, height: 44, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 22, height: 44, count: 4 },
    description: 'Four-frame Koenig tuning fork sheet, the tines swinging as it rings.',
  },
  'machine.emitterDish': {
    id: 'machine.emitterDish', file: 'machine/era4/emitter-dish.png', width: 40, height: 64, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Parabolic emitter dish on a yoke, facing outward from the tower.',
  },
  'machine.dishWaves': {
    id: 'machine.dishWaves', file: 'machine/era4/dish-waves.png', width: 240, height: 64, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    frame: { width: 40, height: 64, count: 6 },
    description: 'Six-frame sheet of the rings of wave light that leave an emitter dish.',
  },
  'machine.crystal': {
    id: 'machine.crystal', file: 'machine/era4/crystal.png', width: 128, height: 48, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 32, height: 48, count: 4 },
    description: 'Four-frame quartz crystal sheet seated in the crown, one glow level per frame.',
  },
  // Era V: null chamber, containment rings, siphons, gravitic anchors, inversion ghost, lens, aperture, name plate (delivered PNGs under machine/era5/).
  'machine.nullGallery': {
    id: 'machine.nullGallery', file: 'machine/era5/null-gallery.png', width: 128, height: 30, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Low gallery rail under the null chamber, a bare steel ledge with a pale edge.',
  },
  'machine.nullChamber': {
    id: 'machine.nullChamber', file: 'machine/era5/null-chamber.png', width: 128, height: 116, origin: { x: 0.5, y: 1 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/null-chamber.png' },
    description: 'Null chamber: a riveted lantern housing on the spire with two yoke eyes on its flanks.',
  },
  'machine.nullCore': {
    id: 'machine.nullCore', file: 'machine/era5/null-core.png', width: 64, height: 64, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/null-core.png', rotationFile: 'machine/era5/restored/rot/null-core-rot.png' },
    rotation: { file: 'machine/era5/rot/null-core-rot.png', frames: 64 },
    description: 'Null core seen face-on: a dark sphere with a faint rim, turned by the exotic flux.',
  },
  'machine.nullCoreGlint': {
    id: 'machine.nullCoreGlint', file: 'machine/era5/null-core-glint.png', width: 64, height: 64, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/null-core-glint.png' },
    description: 'Specular glint laid over the null core, a single pale highlight on the sphere.',
  },
  'machine.ring1Back': {
    id: 'machine.ring1Back', file: 'machine/era5/ring1-back.png', width: 112, height: 72, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/ring1-back.png' },
    description: 'First containment ring, back half: the arc that passes behind the core.',
  },
  'machine.ring2Back': {
    id: 'machine.ring2Back', file: 'machine/era5/ring2-back.png', width: 112, height: 72, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/ring2-back.png' },
    description: 'Second containment ring, back half: the arc that passes behind the core.',
  },
  'machine.ring3Back': {
    id: 'machine.ring3Back', file: 'machine/era5/ring3-back.png', width: 112, height: 72, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/ring3-back.png' },
    description: 'Third containment ring, back half: the arc that passes behind the core.',
  },
  'machine.ring4Back': {
    id: 'machine.ring4Back', file: 'machine/era5/ring4-back.png', width: 112, height: 72, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/ring4-back.png' },
    description: 'Fourth containment ring, back half: the outermost arc that passes behind the core.',
  },
  'machine.ring1Front': {
    id: 'machine.ring1Front', file: 'machine/era5/ring1-front.png', width: 112, height: 72, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/ring1-front.png' },
    description: 'First containment ring, front half: the arc that crosses in front of the core.',
  },
  'machine.ring2Front': {
    id: 'machine.ring2Front', file: 'machine/era5/ring2-front.png', width: 112, height: 72, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/ring2-front.png' },
    description: 'Second containment ring, front half: the arc that crosses in front of the core.',
  },
  'machine.ring3Front': {
    id: 'machine.ring3Front', file: 'machine/era5/ring3-front.png', width: 112, height: 72, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/ring3-front.png' },
    description: 'Third containment ring, front half: the arc that crosses in front of the core.',
  },
  'machine.ring4Front': {
    id: 'machine.ring4Front', file: 'machine/era5/ring4-front.png', width: 112, height: 72, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/ring4-front.png' },
    description: 'Fourth containment ring, front half: the outermost arc that crosses in front of the core.',
  },
  'machine.ringBead': {
    id: 'machine.ringBead', file: 'machine/era5/ring-bead.png', width: 5, height: 5, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/ring-bead.png' },
    description: 'Five-pixel bead that rides a containment ring.',
  },
  'machine.siphonTube': {
    id: 'machine.siphonTube', file: 'machine/era5/siphon-tube.png', width: 12, height: 30, origin: { x: 0.5, y: 1 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/siphon-tube.png' },
    description: 'Narrow glass siphon tube standing on the gallery, one of six in pairs.',
  },
  'machine.siphonArcs1': {
    id: 'machine.siphonArcs1', file: 'machine/era5/siphon-arcs-1.png', width: 512, height: 64, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/siphon-arcs-1.png' },
    frame: { width: 128, height: 64, count: 4 },
    description: 'Four-frame resonance arc sheet for the first siphon pair, arcs flickering between the tubes.',
  },
  'machine.siphonArcs2': {
    id: 'machine.siphonArcs2', file: 'machine/era5/siphon-arcs-2.png', width: 512, height: 64, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/siphon-arcs-2.png' },
    frame: { width: 128, height: 64, count: 4 },
    description: 'Four-frame resonance arc sheet for the second siphon pair, arcs flickering between the tubes.',
  },
  'machine.siphonArcs3': {
    id: 'machine.siphonArcs3', file: 'machine/era5/siphon-arcs-3.png', width: 512, height: 64, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/siphon-arcs-3.png' },
    frame: { width: 128, height: 64, count: 4 },
    description: 'Four-frame resonance arc sheet for the third siphon pair, arcs flickering between the tubes.',
  },
  'machine.graviticAnchor': {
    id: 'machine.graviticAnchor', file: 'machine/era5/gravitic-anchor.png', width: 32, height: 128, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Gravitic anchor pile driven into the sand, with a guy eye at its head.',
  },
  'machine.anchorGlow1': {
    id: 'machine.anchorGlow1', file: 'machine/era5/anchor-glow-1.png', width: 128, height: 128, origin: { x: 0.5, y: 1 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/anchor-glow-1.png' },
    frame: { width: 32, height: 128, count: 4 },
    description: 'Four-frame glow sheet for the first gravitic anchor stage, a faint halo along the pile.',
  },
  'machine.anchorGlow2': {
    id: 'machine.anchorGlow2', file: 'machine/era5/anchor-glow-2.png', width: 128, height: 128, origin: { x: 0.5, y: 1 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/anchor-glow-2.png' },
    frame: { width: 32, height: 128, count: 4 },
    description: 'Four-frame glow sheet for the second gravitic anchor stage, a brighter halo along the pile.',
  },
  'machine.anchorGlow3': {
    id: 'machine.anchorGlow3', file: 'machine/era5/anchor-glow-3.png', width: 128, height: 128, origin: { x: 0.5, y: 1 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/anchor-glow-3.png' },
    frame: { width: 32, height: 128, count: 4 },
    description: 'Four-frame glow sheet for the third gravitic anchor stage, the strongest halo along the pile.',
  },
  'machine.inversionGhost': {
    id: 'machine.inversionGhost', file: 'machine/era5/inversion-ghost.png', width: 48, height: 48, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/inversion-ghost.png', rotationFile: 'machine/era5/restored/rot/inversion-ghost-rot.png' },
    rotation: { file: 'machine/era5/rot/inversion-ghost-rot.png', frames: 80 },
    description: 'Inversion ghost: a faint mirrored copy of the hand crank that trails the real crank.',
  },
  'machine.lensLight': {
    id: 'machine.lensLight', file: 'machine/era5/lens-light.png', width: 128, height: 48, origin: { x: 0.5, y: 1 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/lens-light.png' },
    frame: { width: 32, height: 48, count: 4 },
    description: 'Four-frame lens light sheet: a pale beam source at the lens base, flickering per frame.',
  },
  'machine.lensColumn': {
    id: 'machine.lensColumn', file: 'machine/era5/lens-column.png', width: 32, height: 48, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Lens column: a tall glass tube that gathers the core into one line.',
  },
  'machine.aperture': {
    id: 'machine.aperture', file: 'machine/era5/aperture.png', width: 384, height: 28, origin: { x: 0.5, y: 1 }, tileable: 'none',
    restored: { file: 'machine/era5/restored/aperture.png' },
    frame: { width: 64, height: 28, count: 6 },
    description: 'Six-frame aperture sheet: a crown shutter that opens one leaf per frame toward the sky.',
  },
  'machine.namePlate': {
    id: 'machine.namePlate', file: 'machine/era5/name-plate.png', width: 240, height: 11, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 40, height: 11, count: 6 },
    description: 'Six-frame name plate on the girder: the stamped label lights one more stage per frame.',
  },
  // Era V finale backdrops and the aperture beam (delivered PNGs under finale/ and fx/).
  'bg.skyViolet': {
    id: 'bg.skyViolet', file: 'finale/sky-violet.png', width: 1280, height: 720, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Violet night sky in hard stepped strata, screen-fixed, faded in as the null tech stages arrive.',
  },
  'bg.eclipse': {
    id: 'bg.eclipse', file: 'finale/eclipse.png', width: 288, height: 48, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    frame: { width: 48, height: 48, count: 6 },
    description: 'Six-frame eclipse sheet: a dark disc with a ring that grows across the sky, frame 0 is the baked sun.',
  },
  'bg.horizonGlow': {
    id: 'bg.horizonGlow', file: 'finale/horizon-glow.png', width: 1280, height: 720, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Soft glow along the horizon on every side, screen-fixed, brightening with the horizon field.',
  },
  'fx.beam': {
    id: 'fx.beam', file: 'fx/beam.png', width: 64, height: 32, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 16, height: 32, count: 4 },
    description: 'Four-frame aperture beam tile: a pale vertical shaft of light, one 16-px slice per frame.',
  },
  // WP13 restored world, finale fx and UI (delivered PNGs under finale/, terrain/, fx/ and ui/; ART_ERA5 §11).
  'bg.skyRestored': {
    id: 'bg.skyRestored', file: 'finale/sky-restored.png', width: 1280, height: 720, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Restored clear sky in hard stepped strata, screen-fixed, faded in by the finale track over the violet sky.',
  },
  'bg.mountainsRestored': {
    id: 'bg.mountainsRestored', file: 'finale/mountains-restored.png', width: 512, height: 256, origin: { x: 0, y: 1 }, tileable: 'x',
    description: 'Far ridge recoloured green with foothills; tiles horizontally, same footprint as bg.mountains.',
  },
  'bg.skylineRestored': {
    id: 'bg.skylineRestored', file: 'finale/skyline-restored.png', width: 512, height: 320, origin: { x: 0, y: 1 }, tileable: 'x',
    description: 'Restored city skyline on the same footprints as bg.skyline; tiles horizontally, period = width.',
  },
  'bg.regrowth1': {
    id: 'bg.regrowth1', file: 'finale/regrowth-1.png', width: 512, height: 32, origin: { x: 0, y: 1 }, tileable: 'x',
    description: 'Regrowth strip, stage 1 of 3 (succession order, ART_ERA5 §1); tiles horizontally, period = width.',
  },
  'bg.regrowth2': {
    id: 'bg.regrowth2', file: 'finale/regrowth-2.png', width: 512, height: 32, origin: { x: 0, y: 1 }, tileable: 'x',
    description: 'Regrowth strip, stage 2 of 3 (succession order, ART_ERA5 §1); tiles horizontally, period = width.',
  },
  'bg.regrowth3': {
    id: 'bg.regrowth3', file: 'finale/regrowth-3.png', width: 512, height: 32, origin: { x: 0, y: 1 }, tileable: 'x',
    description: 'Regrowth strip, stage 3 of 3 (succession order, ART_ERA5 §1); tiles horizontally, period = width.',
  },
  'terrain.groundGreen': {
    id: 'terrain.groundGreen', file: 'terrain/ground-green.png', width: 256, height: 128, origin: { x: 0, y: 0 }, tileable: 'xy',
    description: 'Green recolour of terrain.ground with the same seams; tiles in both directions.',
  },
  'fx.beamWhite': {
    id: 'fx.beamWhite', file: 'fx/beam-white.png', width: 64, height: 32, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 16, height: 32, count: 4 },
    description: 'Four-frame white beam tile: the pale light shaft of the finale, one 16-px slice per frame.',
  },
  'fx.seed': {
    id: 'fx.seed', file: 'fx/seed.png', width: 32, height: 8, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    frame: { width: 8, height: 8, count: 4 },
    description: 'Four-frame seed mote drifting over the restored ground; one 8-px cell per frame.',
  },
  'fx.bird': {
    id: 'fx.bird', file: 'fx/bird.png', width: 16, height: 5, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    frame: { width: 8, height: 5, count: 2 },
    description: 'Two-frame bird silhouette (wing up / down) for the flocks over the restored world.',
  },
  'ui.nameplate': {
    id: 'ui.nameplate', file: 'ui/nameplate.png', width: 136, height: 24, origin: { x: 0, y: 0 }, tileable: 'none',
    description: 'Finale nameplate, drawn once and shown three times in the top-left corner (ART_ERA5 §10).',
  },
  'ui.panel': {
    id: 'ui.panel', file: 'ui/panel.png', width: 24, height: 24, origin: { x: 0, y: 0 }, tileable: 'none',
    description: 'Nine-slice terminal panel frame for the finale overlay (ART_ERA5 §8).',
  },
  'ui.button': {
    id: 'ui.button', file: 'ui/button.png', width: 72, height: 24, origin: { x: 0, y: 0 }, tileable: 'none',
    frame: { width: 24, height: 24, count: 3 },
    description: 'Three-frame finale button sheet, 24-px cells (ART_ERA5 §8).',
  },
  'ui.icons16': {
    id: 'ui.icons16', file: 'ui/icons16.png', width: 80, height: 16, origin: { x: 0, y: 0 }, tileable: 'none',
    frame: { width: 16, height: 16, count: 5 },
    description: 'Five 16-px icons for the finale buttons (ART_ERA5 §8).',
  },
  // WP17 legacy feed parts: A17 art under machine/legacy/ (glow sheet, bellows sheet, three single images); the procedural painters in painters/legacy.ts stay as the load-failure fallback.
  'machine.generatorGlow': {
    id: 'machine.generatorGlow', file: 'machine/legacy/generator-glow.png', width: 384, height: 64, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    frame: { width: 96, height: 64, count: 4 },
    description: 'Four-frame EE gauge overlay laid 1:1 on the generator (frame = EE/s level): field-coil turn gaps, armature air-gap ring, terminal caps and brush sparks light cyan; everything stays inside the generator silhouette except the level-3 brush sparks, which rise up to 2 px above the terminal caps; drawn under the belt and the generator pulley.',
  },
  'machine.bellows': {
    id: 'machine.bellows', file: 'machine/legacy/bellows.png', width: 240, height: 28, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 60, height: 28, count: 4 },
    description: 'Four-frame great forge bellows (open, half, closed, half) on two iron legs; the boards hinge at the iron snout and the nozzle (texture 59, rows 16..17) feeds the hose to the boiler tuyere.',
  },
  'machine.exciterFeed': {
    id: 'machine.exciterFeed', file: 'machine/legacy/exciter-feed.png', width: 16, height: 28, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Cyan glass insulator on a riveted terminal box with a copper strap into the spire exciter; the cable lug is the cap (texture 10,1).',
  },
  'machine.backfeedTerminal': {
    id: 'machine.backfeedTerminal', file: 'machine/legacy/backfeed-terminal.png', width: 16, height: 28, origin: { x: 0.5, y: 0 }, tileable: 'none',
    description: 'Suspension string under the null gallery deck: hanger plate with a violet lead-in bushing, four cyan glass discs, conductor clamp and copper jumper; the cable lug is the bottom cap (texture 8,26).',
  },
  'machine.steamLance': {
    id: 'machine.steamLance', file: 'machine/legacy/steam-lance.png', width: 16, height: 32, origin: { x: 0.5, y: 0 }, tileable: 'none',
    description: 'Steam lance valve hung under the null gallery deck: mount plate, globe valve with a rust handwheel, flanged inlet at the bottom (texture 8,32).',
  },
  'world.inspector': {
    id: 'world.inspector', file: 'world/inspector.png', width: 380, height: 240, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 20, height: 40, count: 114 },
    eraRows: 6,
    description: 'Inspector sheet, 19 frames per era row (dome hat, long coat, clipboard at the chest, umbrella) in rows I, II, III, IV, V, whole; planned file world/inspector.png.',
  },
  'world.clipboardPages': {
    id: 'world.clipboardPages', file: null, width: 18, height: 3, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 6, height: 3, count: 3 },
    description: 'Cycle trace on the Inspector clipboard, 3 frames of 6x3; WP23b art, procedural fallback until then.',
  },
  'world.dog': {
    id: 'world.dog', file: 'world/dog.png', width: 560, height: 120, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 28, height: 20, count: 120 },
    eraRows: 6,
    description: 'Dog sheet, 20 frames per era row (low wedge, one upright ear, curled tail) in rows I, II, III, IV, V, whole; planned file world/dog.png.',
  },
  'world.stakeChain': {
    id: 'world.stakeChain', file: 'world/stake-chain.png', width: 20, height: 6, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 10, height: 6, count: 2 },
    description: 'Stake with its chain on the ground, 2 frames; planned file world/stake-chain.png.',
  },
  'world.hole': {
    id: 'world.hole', file: 'world/hole.png', width: 64, height: 6, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 16, height: 6, count: 4 },
    description: 'Dig hole in the ground, 4 frames (dig stages); planned file world/hole.png.',
  },
  'world.redBall': {
    id: 'world.redBall', file: null, width: 3, height: 3, origin: { x: 0.5, y: 1 }, tileable: 'none',
    description: 'Red ball prop, one 3x3 frame: mutedOrange ball with a glint and a shadow (postgame); WP23b art, procedural fallback until then.',
  },
  'world.crow': {
    id: 'world.crow', file: 'world/crow.png', width: 240, height: 108, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 24, height: 18, count: 60 },
    eraRows: 6,
    description: 'Crow sheet, 10 frames per era row (wedge body, two wing fans, hooked beak) in rows I, II, III, IV, V, whole; planned file world/crow.png.',
  },
  'world.girl': {
    id: 'world.girl', file: 'world/girl.png', width: 160, height: 168, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 16, height: 28, count: 60 },
    eraRows: 6,
    description: 'Girl with the lantern, 10 frames per era row (hood, raincoat, lantern, stand, talk, shield, back-run) in rows I, II, III, IV, V, whole; planned file world/girl.png.',
  },
  'world.girlMini': {
    id: 'world.girlMini', file: 'world/girl-mini.png', width: 16, height: 12, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 8, height: 12, count: 2 },
    description: 'Girl seen from the pylon plane, 2 frames (lantern warm, lantern cold white); planned file world/girl-mini.png.',
  },
  'world.girlWindow': {
    id: 'world.girlWindow', file: 'world/girl-window.png', width: 16, height: 6, origin: { x: 0, y: 0 }, tileable: 'none',
    frame: { width: 4, height: 6, count: 4 },
    description: 'Girl in the far window, 4 frames (flicker a, flicker b, dark, restored figure at the curtain); planned file world/girl-window.png.',
  },
  'world.lantern': {
    id: 'world.lantern', file: null, width: 12, height: 4, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 6, height: 4, count: 2 },
    description: 'Lantern prop, 2 frames; WP23b art, procedural fallback until then.',
  },
  'world.payphone': {
    id: 'world.payphone', file: 'world/payphone.png', width: 168, height: 312, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 28, height: 52, count: 36 },
    eraRows: 6,
    description: 'Payphone booth, 6 frames per era row (dark, lit hood, ring-shake x2, fog overlay, cracked restored whole) in rows I, II, III, IV, V, whole; tally marks are procedural; planned file world/payphone.png.',
  },
  'world.receiver': {
    id: 'world.receiver', file: 'world/receiver.png', width: 48, height: 72, origin: { x: 0.5, y: 0 }, tileable: 'none',
    frame: { width: 8, height: 12, count: 36 },
    eraRows: 6,
    description: 'Booth receiver, 6 frames per era row (hang, swing x3, level, on hook) in rows I, II, III, IV, V, whole; planned file world/receiver.png.',
  },
  'world.lamp': {
    id: 'world.lamp', file: 'world/street-lamp.png', width: 48, height: 60, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 12, height: 60, count: 4 },
    description: 'Street lamp, 4 frames (dead, lit, warm, restored); planned file world/street-lamp.png.',
  },
  'world.lampGlow': {
    id: 'world.lampGlow', file: 'world/lamp-glow.png', width: 64, height: 16, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    frame: { width: 32, height: 16, count: 2 },
    description: 'Lamp glow overlay, 2 frames (cold, warm); planned file world/lamp-glow.png.',
  },
  'world.clock': {
    id: 'world.clock', file: 'world/street-clock.png', width: 32, height: 44, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 16, height: 44, count: 2 },
    description: 'Street clock, 2 frames (ruin, restored); the hands are a procedural overlay; planned file world/street-clock.png.',
  },
  'world.sensor7': {
    id: 'world.sensor7', file: 'world/sensor7.png', width: 160, height: 240, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 20, height: 40, count: 48 },
    eraRows: 6,
    description: 'Sensor 7, 8 frames per era row (tripod, four head poses, lens fog, two readout glyphs) in rows I, II, III, IV, V, whole; the LED is a separate 1 px sprite; planned file world/sensor7.png.',
  },
  'world.puddle': {
    id: 'world.puddle', file: null, width: 320, height: 5, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 32, height: 5, count: 10 },
    description: 'Puddle strip, 10 frames (3 sizes x grey, ring, black, plus whole); WP23b art, procedural fallback until then.',
  },
  'world.sprout': {
    id: 'world.sprout', file: null, width: 40, height: 24, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 8, height: 24, count: 5 },
    description: 'Sprout, 5 frames (4 white stages, 1 green bloom); WP23b art, procedural fallback until then.',
  },
  'world.scraps': {
    id: 'world.scraps', file: 'world/scraps.png', width: 24, height: 4, origin: { x: 0.5, y: 1 }, tileable: 'none',
    frame: { width: 8, height: 4, count: 3 },
    description: 'Scrap pile on the ground, 3 frames (burned away by the firebox tiers); planned file world/scraps.png.',
  },
  'world.mote': {
    id: 'world.mote', file: 'world/mote.png', width: 4, height: 2, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    frame: { width: 2, height: 2, count: 2 },
    description: 'Ash mote and white moth speck, 2 frames (ash, moth); one emitter with a pool of 5; planned file world/mote.png.',
  },
  'world.page': {
    id: 'world.page', file: null, width: 6, height: 4, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    frame: { width: 3, height: 4, count: 2 },
    description: 'Paper page that lifts from the ground about every 40 s in era IV, 2 frames; WP23b art, procedural fallback until then.',
  },
  'world.shadow': {
    id: 'world.shadow', file: null, width: 26, height: 3, origin: { x: 0.5, y: 0.5 }, tileable: 'none',
    description: 'Procedural shadow ellipse baked once in game; this 26x3 texture is a fallback only and never gets a file.',
  },
  'bg.windowLit': {
    id: 'bg.windowLit', file: 'bg/window-lit.png', width: 8, height: 6, origin: { x: 0, y: 0 }, tileable: 'none',
    frame: { width: 4, height: 6, count: 2 },
    description: 'Lit skyline window in rust-amber, 2 frames (lit, breathe), six placements on the skyline windows; planned file bg/window-lit.png.',
  },
  'bg.virga': {
    id: 'bg.virga', file: null, width: 512, height: 128, origin: { x: 0, y: 1 }, tileable: 'x',
    frame: { width: 512, height: 64, count: 2 },
    description: 'Rain streak strip tiling on x above the mountain ridge, 2 frames (falling, frozen), sky ramp only; WP23b art, procedural fallback until then.',
  },
};

export interface AssetLoad {
  key: string; // an AssetId, `${AssetId}#rot`, `${AssetId}#restored` or `${AssetId}#restored#rot`
  url: string;
  kind: 'image' | 'spritesheet';
  frame?: AssetEntry['frame'];
}

/** Returns the URL for a file-backed entry (baseUrl + file), or null for procedural-only entries. */
export function resolveAssetUrl(entry: AssetEntry, baseUrl: string = 'assets/'): string | null {
  return entry.file === null ? null : baseUrl + entry.file;
}

/**
 * Lists load descriptors in ASSET_IDS order for every file-backed entry (kind = spritesheet iff frame).
 * Each entry with a rotation sheet also gets a `${id}#rot` spritesheet load right after its own load.
 * A file-backed entry with `restored` adds a `${id}#restored` load (and, with a rotation sheet and restored.rotationFile, `${id}#restored#rot`) right after its own / #rot loads.
 */
export function planAssetLoads(
  manifest: Record<AssetId, AssetEntry> = ASSET_MANIFEST,
  baseUrl: string = 'assets/',
): AssetLoad[] {
  const loads: AssetLoad[] = [];
  for (const id of ASSET_IDS) {
    const entry = manifest[id];
    const url = resolveAssetUrl(entry, baseUrl);
    if (url !== null) {
      const load: AssetLoad = { key: id, url, kind: entry.frame ? 'spritesheet' : 'image' };
      if (entry.frame !== undefined) load.frame = entry.frame;
      loads.push(load);
    }
    if (entry.rotation !== undefined) {
      loads.push({
        key: id + '#rot',
        url: baseUrl + entry.rotation.file,
        kind: 'spritesheet',
        frame: { width: entry.width, height: entry.height, count: entry.rotation.frames },
      });
    }
    if (entry.file !== null && entry.restored !== undefined) {
      const restoredLoad: AssetLoad = {
        key: restoredTextureKey(id, false),
        url: baseUrl + entry.restored.file,
        kind: entry.frame ? 'spritesheet' : 'image',
      };
      if (entry.frame !== undefined) restoredLoad.frame = entry.frame;
      loads.push(restoredLoad);
    }
    if (entry.rotation !== undefined && entry.restored?.rotationFile !== undefined) {
      loads.push({
        key: restoredTextureKey(id, true),
        url: baseUrl + entry.restored.rotationFile,
        kind: 'spritesheet',
        frame: { width: entry.width, height: entry.height, count: entry.rotation.frames },
      });
    }
  }
  return loads;
}

/**
 * Cell rectangles of a spritesheet entry, row-major, cols = floor(width / frame.width); [] without `frame`.
 * Only the first `frame.count` cells are returned.
 */
export function sheetFrameRects(entry: AssetEntry): Array<{ x: number; y: number; width: number; height: number }> {
  if (entry.frame === undefined) return [];
  const { width, height, count } = entry.frame;
  const cols = Math.floor(entry.width / width);
  const rects: Array<{ x: number; y: number; width: number; height: number }> = [];
  for (let i = 0; i < count; i++) {
    rects.push({ x: (i % cols) * width, y: Math.floor(i / cols) * height, width, height });
  }
  return rects;
}

/** Returns the ids for which has(id) is false, in the order given. */
export function missingTextureIds(has: (key: string) => boolean, ids: readonly AssetId[] = ASSET_IDS): AssetId[] {
  return ids.filter((id) => !has(id));
}
