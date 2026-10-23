// Pure zoom and box maths for the DOM UI root, which follows the game canvas (WP19 T4). No DOM, no Phaser.
import { UI_ZOOM } from '../data/display';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const round4 = (x: number): number => Math.round(x * 10000) / 10000;

/**
 * Zoom for the UI root: canvas height over the base height (never below minCanvasScale), times the UI scale
 * setting (percent). Invalid inputs fall back to 100 % and a fit of 1. Capped at maxZoom. Rounded to 4 decimals.
 */
export function uiZoom(canvasH: number, uiScale: number): number {
  const scale = (Number.isFinite(uiScale) && uiScale > 0 ? uiScale : 100) / 100;
  const fit = Number.isFinite(canvasH) && canvasH > 0 ? Math.max(UI_ZOOM.minCanvasScale, canvasH / UI_ZOOM.baseHeight) : 1;
  return round4(Math.min(UI_ZOOM.maxZoom, fit * scale));
}

/** Root box in unzoomed CSS px: each field of rect divided by zoom. A non-finite zoom or zoom <= 0 counts as 1. */
export function rootBox(rect: Box, zoom: number): Box {
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return {
    left: rect.left / z,
    top: rect.top / z,
    width: rect.width / z,
    height: rect.height / z,
  };
}

/** CSS length in px, rounded to 3 decimals. */
export function cssPx(n: number): string {
  return `${Math.round(n * 1000) / 1000}px`;
}
