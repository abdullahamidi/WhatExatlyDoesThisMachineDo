import './worldVoice.css';
import { bubbleClass, bubbleTransform, liveText, snapToDevicePx } from './worldVoiceModel';
import type { WorldVoicePos } from './worldVoiceModel';

// Speech bubble view (WP23a, DENIZEN_ART 4.1). DOM only: no Phaser. Two pooled bubbles (a unison line uses both slots), one probe
// for text measurement and one polite live region, all created once and appended to #ui-root. Per frame only transform, opacity
// and --tx are written, and only when they change. The bubbles are aria-hidden: the live region speaks the line instead.
// Text is always written with textContent.

export type WorldVoiceSlot = 0 | 1;
export interface WorldVoiceRect { x: number; y: number; w: number; h: number }

export interface WorldVoiceView {
  /** Wrapped size of a line at a max width (CSS px). One forced reflow per call; never per frame. */
  measure(text: string, maxWidth: number): { w: number; h: number };
  show(slot: WorldVoiceSlot, text: string, pos: WorldVoicePos, maxWidth: number): void;
  move(slot: WorldVoiceSlot, pos: WorldVoicePos): void;
  /** Hides a shown bubble. instant: no fade, the transition is off until the next frame. */
  hide(slot: WorldVoiceSlot, instant?: boolean): void;
  visible(slot?: WorldVoiceSlot): boolean;
  /** Box in #ui-root CSS px (the transform space), or null while the slot is hidden. */
  rect(slot: WorldVoiceSlot): WorldVoiceRect | null;
  /** UI zoom of #ui-root. Boxes and tails snap to whole device px at this zoom (AD2 F11). Ignored unless finite and > 0. */
  setZoom(zoom: number): void;
  /** Last line written to the slot. */
  text(slot: WorldVoiceSlot): string;
  /** Sets the live region to `prefix line`. Cleared first, so a repeated line is announced again. */
  announce(prefix: string, text: string): void;
  destroy(): void;
}

interface Slot {
  el: HTMLDivElement;
  on: boolean;
  up: boolean;
  text: string;
  x: number;
  y: number;
  transform: string;
  tailX: number | null;
}

function makeSlot(id: string): Slot {
  const el = document.createElement('div');
  el.id = id;
  el.className = bubbleClass(false, false);
  el.setAttribute('aria-hidden', 'true');
  return { el, on: false, up: false, text: '', x: 0, y: 0, transform: '', tailX: null };
}

export function createWorldVoiceView(root: HTMLElement): WorldVoiceView {
  const slots: readonly [Slot, Slot] = [makeSlot('world-voice'), makeSlot('world-voice-2')];

  // Laid out like a bubble, never seen: .wv is opacity 0 and aria-hidden already.
  const probe = document.createElement('div');
  probe.className = 'wv';
  probe.setAttribute('aria-hidden', 'true');

  const live = document.createElement('div');
  live.id = 'world-voice-live';
  live.className = 'wv-live';
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');

  root.append(slots[0].el, slots[1].el, probe, live);
  let destroyed = false;
  let uiZoom = 1;

  // Writes the transform only when the device-px box moved. The stored origin is the snapped one, so rect() matches the paint.
  function writeBox(s: Slot, pos: WorldVoicePos): void {
    s.x = snapToDevicePx(pos.x, uiZoom);
    s.y = snapToDevicePx(pos.y, uiZoom);
    const transform = bubbleTransform(pos, uiZoom);
    if (transform === s.transform) return;
    s.transform = transform;
    s.el.style.transform = transform;
  }

  // Writes --tx only when the snapped tail moved.
  function writeTail(s: Slot, tailX: number): void {
    const px = snapToDevicePx(tailX, uiZoom);
    if (px === s.tailX) return;
    s.tailX = px;
    s.el.style.setProperty('--tx', `${px}px`);
  }

  return {
    measure(text: string, maxWidth: number): { w: number; h: number } {
      probe.textContent = text;
      probe.style.maxWidth = `${maxWidth}px`;
      return { w: probe.offsetWidth, h: probe.offsetHeight };
    },

    show(slot: WorldVoiceSlot, text: string, pos: WorldVoicePos, maxWidth: number): void {
      if (destroyed) return;
      const s = slots[slot];
      s.text = text;
      s.el.textContent = text;
      s.el.style.maxWidth = `${maxWidth}px`;
      writeTail(s, pos.tailX);
      writeBox(s, pos);
      s.on = true;
      s.up = pos.tailUp;
      s.el.className = bubbleClass(true, pos.tailUp);
    },

    move(slot: WorldVoiceSlot, pos: WorldVoicePos): void {
      if (destroyed) return;
      const s = slots[slot];
      writeTail(s, pos.tailX);
      writeBox(s, pos);
      // The side flips only when the ladder moves the bubble across the head (rare, not per frame).
      if (pos.tailUp !== s.up) {
        s.up = pos.tailUp;
        s.el.classList.toggle('up', s.up);
      }
    },

    hide(slot: WorldVoiceSlot, instant = false): void {
      const s = slots[slot];
      if (destroyed || !s.on) return;
      s.on = false;
      s.el.classList.remove('on');
      if (!instant) return;
      // The cut lasts one frame: the inline transition is off until the next frame, then the stylesheet's fade applies again.
      s.el.style.transition = 'none';
      window.requestAnimationFrame(() => {
        s.el.style.transition = '';
      });
    },

    visible(slot?: WorldVoiceSlot): boolean {
      if (slot !== undefined) return slots[slot].on;
      return slots[0].on || slots[1].on;
    },

    rect(slot: WorldVoiceSlot): WorldVoiceRect | null {
      const s = slots[slot];
      if (!s.on) return null;
      return { x: s.x, y: s.y, w: s.el.offsetWidth, h: s.el.offsetHeight };
    },

    setZoom(zoom: number): void {
      // A bad reading (NaN, or 0 while the root is not laid out) keeps the last good zoom.
      if (!Number.isFinite(zoom) || zoom <= 0) return;
      uiZoom = zoom;
    },

    text(slot: WorldVoiceSlot): string {
      return slots[slot].text;
    },

    announce(prefix: string, text: string): void {
      if (destroyed) return;
      live.textContent = '';
      // Flush the cleared state first, so the same line read twice is a new change for the reader.
      void live.offsetWidth;
      live.textContent = liveText(prefix, text);
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      for (const s of slots) {
        s.on = false;
        s.el.remove();
      }
      probe.remove();
      live.remove();
    },
  };
}
