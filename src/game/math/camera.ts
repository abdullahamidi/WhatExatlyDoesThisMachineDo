import type { Vec2 } from '../../data/machineComponents';

export interface Size { width: number; height: number }
export interface RectLike { left: number; top: number; width: number; height: number }

// min zoom at which the whole world fits the view: max(view.w / world.w, view.h / world.h)
export function minZoomToFit(view: Size, world: Size): number {
  return Math.max(view.width / world.width, view.height / world.height);
}

// clamp zoom into [min, max]
export function clampZoom(z: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, z));
}

// per axis: vl = viewLen / zoom; if vl >= worldLen -> worldLen / 2, else clamp into [vl / 2, worldLen - vl / 2]
function clampAxis(c: number, viewLen: number, zoom: number, worldLen: number): number {
  const visible = viewLen / zoom;
  if (visible >= worldLen) return worldLen / 2;
  const half = visible / 2;
  return Math.min(worldLen - half, Math.max(half, c));
}

// keeps the visible world rect (view / zoom, centred on c) inside the world; returns a new object
export function clampCenter(center: Vec2, zoom: number, view: Size, world: Size): Vec2 {
  return {
    x: clampAxis(center.x, view.width, zoom, world.width),
    y: clampAxis(center.y, view.height, zoom, world.height),
  };
}

// newCenter = pointer - (pointer - center) * (oldZoom / newZoom): the pointer's world point keeps its screen pixel
export function zoomAroundPoint(center: Vec2, pointerWorld: Vec2, oldZoom: number, newZoom: number): Vec2 {
  const ratio = oldZoom / newZoom;
  return {
    x: pointerWorld.x - (pointerWorld.x - center.x) * ratio,
    y: pointerWorld.y - (pointerWorld.y - center.y) * ratio,
  };
}

// deltaY < 0 -> zoom * factor (in); deltaY > 0 -> zoom / factor (out); 0 -> unchanged; then clamped to [min, max]
export function wheelToZoom(zoom: number, deltaY: number, factor: number, min: number, max: number): number {
  let next = zoom;
  if (deltaY < 0) next = zoom * factor;
  else if (deltaY > 0) next = zoom / factor;
  return clampZoom(next, min, max);
}

// zoom grid step: PIXEL_SCALE * zoom is then an integer or half-integer, so art pixels stay even on screen
export function zoomStep(pixelScale: number): number {
  return 0.5 / pixelScale;
}

// nearest grid zoom (k * step, k integer), clamped into [min, max]
export function snapZoom(zoom: number, pixelScale: number, min: number, max: number): number {
  const step = zoomStep(pixelScale);
  return clampZoom(Math.round(zoom / step) * step, min, max);
}

// one wheel notch: deltaY < 0 -> next grid value above zoom; deltaY > 0 -> next grid value below; 0 -> snap.
// The 1e-9 margin makes a zoom already on the grid step past itself instead of repeating.
export function wheelToSnappedZoom(zoom: number, deltaY: number, pixelScale: number, min: number, max: number): number {
  if (deltaY === 0) return snapZoom(zoom, pixelScale, min, max);
  const step = zoomStep(pixelScale);
  const next = deltaY < 0
    ? (Math.floor((zoom + 1e-9) / step) + 1) * step
    : (Math.ceil((zoom - 1e-9) / step) - 1) * step;
  return clampZoom(next, min, max);
}

// dragging right (positive delta) moves the camera left: start - delta / zoom, per axis
export function dragToCenter(startCenter: Vec2, dragScreenDelta: Vec2, zoom: number): Vec2 {
  return {
    x: startCenter.x - dragScreenDelta.x / zoom,
    y: startCenter.y - dragScreenDelta.y / zoom,
  };
}

// screen = (world - worldView) * zoom (game px); client = canvas.left + screen * canvas.width / game.width (same for y)
export function worldToClient(
  world: Vec2,
  worldView: Vec2,
  zoom: number,
  canvasRect: RectLike,
  gameSize: Size,
): Vec2 {
  const screenX = (world.x - worldView.x) * zoom;
  const screenY = (world.y - worldView.y) * zoom;
  return {
    x: canvasRect.left + (screenX * canvasRect.width) / gameSize.width,
    y: canvasRect.top + (screenY * canvasRect.height) / gameSize.height,
  };
}
