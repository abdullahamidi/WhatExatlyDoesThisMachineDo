import { PART_TIER_FX } from '../../data/machineTiers';

// WP22 tier-up beat timeline (docs/plan/PART_TIERS.md §3.1 full motion, §3.4 reduced motion). Pure: the renderer asks for the
// frame at a beat-local time and draws what it says. Every timing comes from PART_TIER_FX; nothing here tunes feel.

/** What the tier-up beat shows at one instant. Full and reduced motion share the shape; fields a mode does not use are inert. */
export interface TierBeatFrame {
  /** Heat-flash step: 0 none, 1 first step (old texture at alpha 0.85), 2 second step (alpha 0.6). */
  flash: 0 | 1 | 2;
  /** True once the host shows the new texture. */
  swapped: boolean;
  /** Old-shell ghost scale and alpha, or null when no ghost is drawn. */
  ghost: { scale: number; alpha: number } | null;
  /** Bolt-down spark crowns lit (0 to 2). */
  bolts: number;
  /** Shine sweep progress 0 to 1, or null when no sweep runs. */
  shine: number | null;
  /** Settle shake active. */
  shake: boolean;
  /** Reduced-motion crossfade of the old texture (alpha 1 to 0), or null when the crossfade is over. */
  fade: number | null;
  /** Reduced-motion static glints at the mount points. */
  glints: boolean;
  /** The beat is over. */
  done: boolean;
}

/** Beat frame at tMs after the beat starts. Negative time reads as 0; non-finite time (NaN, Infinity) reads as 0. */
export function tierBeatFrame(tMs: number, reduced: boolean, fx: typeof PART_TIER_FX = PART_TIER_FX): TierBeatFrame {
  const t = Number.isFinite(tMs) ? Math.max(0, tMs) : 0;
  return reduced ? reducedFrame(t, fx) : fullFrame(t, fx);
}

function fullFrame(t: number, fx: typeof PART_TIER_FX): TierBeatFrame {
  const swapped = t >= fx.swapAtMs;
  let ghost: TierBeatFrame['ghost'] = null;
  if (swapped && t < fx.swapAtMs + fx.ghostMs) {
    const p = (t - fx.swapAtMs) / fx.ghostMs;
    ghost = { scale: 1 + (fx.ghostScale - 1) * p, alpha: fx.ghostAlpha * (1 - p) };
  }
  const [shineFrom, shineTo] = fx.shineMs;
  return {
    flash: t < fx.flashStepMs ? 1 : t < 2 * fx.flashStepMs ? 2 : 0,
    swapped,
    ghost,
    bolts: fx.boltAtMs.filter((at) => t >= at).length,
    shine: t >= shineFrom && t < shineTo ? (t - shineFrom) / (shineTo - shineFrom) : null,
    shake: t >= fx.settleMs,
    fade: null,
    glints: false,
    done: t >= fx.beatMs,
  };
}

function reducedFrame(t: number, fx: typeof PART_TIER_FX): TierBeatFrame {
  return {
    flash: 0,
    swapped: true,
    ghost: null,
    bolts: 0,
    shine: null,
    shake: false,
    fade: t < fx.reducedFadeMs ? 1 - t / fx.reducedFadeMs : null,
    glints: t < fx.reducedGlintMs,
    done: t >= Math.max(fx.reducedFadeMs, fx.reducedGlintMs),
  };
}
