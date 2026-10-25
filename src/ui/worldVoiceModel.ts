// Pure model for the living-world speech bubble (WP23a, DENIZEN_ART 4.1): transform string, class list and live-region text.
// Why: the DOM view in worldVoice.ts stays a thin writer, and these rules are unit-tested in the node environment (no DOM, no Phaser).

/** Where one bubble sits: box origin in #ui-root CSS px (before the root zoom), tail tip x inside the box, tail side. */
export interface WorldVoicePos { x: number; y: number; tailX: number; tailUp: boolean }

/** Rounds a CSS px value to a whole device px at the root zoom: Math.round(v * zoom) / zoom (zoom 1: whole CSS px).
 *  Why: #ui-root is scaled by the UI zoom (125 / 150 %), so a whole CSS px is a fractional device px and the edges blur. */
export function snapToDevicePx(value: number, zoom: number): number {
  return Math.round(value * zoom) / zoom;
}

/** The only transform a bubble gets: translate(Xpx, Ypx) on whole device px at the root zoom. The tail goes through --tx, not here. */
export function bubbleTransform(pos: WorldVoicePos, zoom = 1): string {
  return `translate(${snapToDevicePx(pos.x, zoom)}px, ${snapToDevicePx(pos.y, zoom)}px)`;
}

/** Class list of one bubble: 'wv', plus 'on' while shown, plus 'up' when the tail points up (bubble below the feet). */
export function bubbleClass(on: boolean, up: boolean): string {
  let cls = 'wv';
  if (on) cls += ' on';
  if (up) cls += ' up';
  return cls;
}

/** Text of the polite live region: the speaker prefix, one space, then the line (WORLD_A11Y_PREFIX supplies the prefix). */
export function liveText(prefix: string, text: string): string {
  return `${prefix} ${text}`;
}
