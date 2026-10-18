// Global balance constants. All tunable numbers that are not per-technology live here.

/** Maximum offline progress credited on load, in seconds (8 hours). */
export const OFFLINE_CAP_SECONDS = 8 * 3600;

/** How often the game autosaves, in milliseconds. */
export const AUTOSAVE_INTERVAL_MS = 15000;

/** localStorage key for the active save. */
export const SAVE_KEY = 'wedtmd.save';

/** localStorage key where a corrupt save is backed up before recovery. */
export const SAVE_BACKUP_KEY = 'wedtmd.save.corrupt';

/** localStorage key where the current save is copied before a player import overwrites it. */
export const SAVE_PREIMPORT_KEY = 'wedtmd.save.preimport';

/** Largest simulated time step applied by a single update, in seconds. */
export const MAX_UPDATE_SECONDS = OFFLINE_CAP_SECONDS;

/**
 * Gaps between updates longer than this, in seconds, are treated as offline time and reported
 * (e.g. a tab resuming after being hidden), instead of being advanced silently.
 */
export const OFFLINE_REPORT_THRESHOLD_SECONDS = 60;

/** Design ceiling: balance simulations assert every value stays finite and below this. */
export const DESIGN_MAX_VALUE = 1e100;

/** All-resource per-second multiplier; stays 1 until prestige (WP15) provides a real one. */
export const META_MULT = 1;
