// Host save storage tuning and player-facing storage text (WP19). Pure data: no logic lives in this file.

// Writes to the host bridge are coalesced: the first write of a burst starts one timer; later writes join it.
export const HOST_STORAGE = { debounceMs: 500 } as const;

// Shown in the title/system area when saves fall back to memory (no host and no usable localStorage).
export const STORAGE_TEXT = {
  memoryTitle: 'SAVES DISABLED',
  memoryBody: 'Storage is blocked here: progress will not be kept. Export it from SYSTEM › DATA.',
} as const;
