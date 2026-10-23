export const UI_ZOOM = { baseHeight: 720, minCanvasScale: 1, maxZoom: 6 } as const;
// Phaser's limiter zeroes its accumulator: limit must sit between common refresh rates (see WP19 D10).
export const FRAME_RATE = { target: 60, limit: 78 } as const;
export const DISPLAY_TEXT = { fullscreen: 'FULLSCREEN', fullscreenKeys: 'F11 / ALT+ENTER' } as const;
// DOM viewport sync: window resize is debounced by this many ms before the UI root is re-fitted to the canvas.
export const VIEWPORT_SYNC = { resizeDebounceMs: 120 } as const;
