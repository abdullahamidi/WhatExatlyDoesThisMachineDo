// Final-machine showcase (WP18) data. Pure data: ids, timings and frames of the portrait, the ShowcaseScene teaser and the restored accent.
import { FINALE_BOOST, FINALE_VIEWS } from './finale';
import type { MachineComponentId } from './machineComponents';
import { RESONANCE_MILESTONE_FX } from './machineComponents';

/** Canonical portrait pose = finale view 'full' (camera 1920, 1080, 0.5): whole machine plus sky. Choice, postgame, REFOCUS and photo mode all use it. */
export const SHOWCASE_PORTRAIT = { view: 'full' } as const satisfies { view: keyof typeof FINALE_VIEWS };
export const SHOWCASE_SCENE_KEY = 'Showcase';
/** Teaser (WP18 ShowcaseScene). Times in seconds since the scene started. */
export const SHOWCASE_TEASER = {
  fromEra: 2,                                                          // start: a complete era II machine
  steps: [{ atS: 1.0, era: 3 }, { atS: 2.5, era: 4 }, { atS: 4.0, era: 5 }],
  camera: { startS: 0.5, durS: 5.0 },                                  // era-II fit pose -> portrait, cubic in-out; reduced motion: portrait from t 0
  boost: { startS: 5.5, rampS: 1.5 },                                  // driver boost 0 -> 1 (cubic in-out), then held
  apertureAtS: 7.0,                                                    // the aperture latch gate tech is held at 0 until here
  endS: 9.5,                                                           // done; the scene keeps rendering the end frame
} as const;
/** Restored accent 'lamps lit': in the restored state with boost 0 these frames / gauge parts hold their bright frame (generatorGlow = top gauge frame, A17 (d)). */
export const RESTORED_ACCENT = {
  holdFrames: { ...FINALE_BOOST.holdFrames, crystal: RESONANCE_MILESTONE_FX.holdFrame, generatorGlow: 3 } satisfies Partial<Record<MachineComponentId, number>>,
} as const;
