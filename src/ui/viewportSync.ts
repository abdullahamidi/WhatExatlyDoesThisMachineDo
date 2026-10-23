// Keeps the DOM UI root on the game canvas rect (letterboxing, UI scale). DOM only, no Phaser.
// Zoom and box maths live in viewportMath.ts; tuning numbers live in src/data/display.ts.
import { UI_ZOOM, VIEWPORT_SYNC } from '../data/display';
import { cssPx, rootBox, uiZoom } from './viewportMath';
import type { Box } from './viewportMath';

export interface ViewportSync {
  /** Re-fits the root to the canvas now. */
  sync(): void;
  /** Zoom applied by the last sync (1 before the first sync). */
  zoom(): number;
  /** Removes the resize listener and any pending debounced sync. */
  destroy(): void;
}

export interface ViewportSyncOptions {
  root: HTMLElement;
  canvas: () => HTMLCanvasElement | null;
  uiScale: () => number;
  win?: Window;
}

/**
 * Binds `root` to the canvas rect: left/top/width/height = canvas rect / zoom, CSS zoom = zoom.
 * Without a usable canvas the viewport stands in and the base height is used for the fit.
 * Creating the sync does not call sync(); a window resize calls it after the debounce.
 */
export function createViewportSync(o: ViewportSyncOptions): ViewportSync {
  const win = o.win ?? window;
  let lastZoom = 1;
  let timer: number | undefined;

  const sync = (): void => {
    const canvas = o.canvas();
    const measured = canvas === null ? null : canvas.getBoundingClientRect();
    const usable = measured !== null && measured.height > 0;
    const rect: Box = usable
      ? measured
      : { left: 0, top: 0, width: win.innerWidth, height: win.innerHeight };
    const canvasH = usable ? measured.height : UI_ZOOM.baseHeight;
    const z = uiZoom(canvasH, o.uiScale());
    const box = rootBox(rect, z);
    const style = o.root.style;
    style.left = cssPx(box.left);
    style.top = cssPx(box.top);
    style.width = cssPx(box.width);
    style.height = cssPx(box.height);
    style.zoom = String(z);
    style.setProperty('--ui-zoom', String(z));
    lastZoom = z;
  };

  const onResize = (): void => {
    if (timer !== undefined) win.clearTimeout(timer);
    timer = win.setTimeout(() => {
      timer = undefined;
      sync();
    }, VIEWPORT_SYNC.resizeDebounceMs);
  };

  win.addEventListener('resize', onResize);

  return {
    sync,
    zoom: (): number => lastZoom,
    destroy(): void {
      win.removeEventListener('resize', onResize);
      if (timer !== undefined) {
        win.clearTimeout(timer);
        timer = undefined;
      }
    },
  };
}
