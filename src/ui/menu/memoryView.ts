// Pure view model for the MEMORY tab (WP14 T7). No DOM, no Phaser.
import { PERK_LIST, PRESTIGE_ART, PRESTIGE_TEXT } from '../../data/prestige';
import type { PerkId } from '../../data/prestige';
import type { PrestigeState } from '../../data/types';
import { cycleLabel, echoMultiplier, perkStatus, unspentEchoes } from '../../simulation/prestige';
import type { CyclePreview, PerkStatus } from '../../simulation/prestige';

// One sprite drawn from a sheet: frame at (frameIndex * box) of a row of frames, drawn at `box` px.
export interface MemorySprite {
  sheet: string; // path relative to public/ (PRESTIGE_ART)
  frameIndex: number;
  box: number; // CSS px of one drawn frame
  bgPosition: string; // CSS background-position for the frame
  bgSize: string; // CSS background-size for the whole sheet
}

export interface MemoryCard {
  id: PerkId;
  name: string;
  description: string;
  status: PerkStatus;
  statusText: string; // OWNED / COST n ECHOES / NEED n ECHOES: status by text, not colour alone
  cost: number;
  canBuy: boolean; // true only when affordable (the RECALL button is enabled)
  buttonText: string | null; // null when owned (no button)
  ariaLabel: string; // "<name>, <status>, <cost>" for the RECALL button
  slot: MemorySprite; // perk-slot frame: locked 0 / affordable 1 / owned 2
  icon: MemorySprite; // perk icon frame from perks.png
}

export interface MemoryView {
  empty: boolean; // no Echo yet and the run is not revealed: only `message` shows
  message: string; // PRESTIGE_TEXT.empty when empty, '' otherwise
  echo: MemorySprite; // currency icon (echo.png)
  echoesText: string; // ECHOES 3 (+90% ALL/S)
  unspentText: string; // UNSPENT 1
  cycleText: string; // CYCLE 0042
  nextCycleText: string | null; // NEXT CYCLE: CYCLE 0043 · +3 ECHOES, only once revealed
  cards: MemoryCard[]; // PERK_LIST order; empty when `empty`
}

const SLOT_FRAMES = Object.keys(PRESTIGE_ART.slot).length;
const PERK_FRAMES = PERK_LIST.length;

// Frame of `frameSize` px at index `frameIndex` in a sheet of `sheetFrames` frames, drawn at `scale`.
function spriteFor(sheet: string, frameIndex: number, frameSize: number, sheetFrames: number): MemorySprite {
  const px = frameSize * PRESTIGE_ART.scale;
  return {
    sheet,
    frameIndex,
    box: px,
    bgPosition: `${-frameIndex * px}px 0px`,
    bgSize: `${sheetFrames * px}px ${px}px`,
  };
}

function statusLine(status: PerkStatus, cost: number, unspent: number): string {
  if (status === 'owned') return PRESTIGE_TEXT.owned;
  if (status === 'affordable') return `${PRESTIGE_TEXT.cost} ${cost} ${PRESTIGE_TEXT.echoes}`;
  return `${PRESTIGE_TEXT.need} ${cost - unspent} ${PRESTIGE_TEXT.echoes}`;
}

/**
 * MEMORY tab model. Header: ECHOES n (+p% ALL/S), UNSPENT u, CYCLE 00xx. Cards: five perks in PERK_LIST
 * order. `revealed` is the WP13 reveal (the NEXT CYCLE line shows only then).
 */
export function buildMemoryView(prestige: PrestigeState, preview: CyclePreview, revealed: boolean): MemoryView {
  const unspent = unspentEchoes(prestige);
  const empty = prestige.echoesEarned <= 0 && !revealed;
  const pct = Math.round((echoMultiplier(prestige) - 1) * 100);

  const cards: MemoryCard[] = empty ? [] : PERK_LIST.map((def) => {
    const status = perkStatus(prestige, def.id);
    const statusText = statusLine(status, def.cost, unspent);
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      status,
      statusText,
      cost: def.cost,
      canBuy: status === 'affordable',
      buttonText: status === 'owned' ? null : PRESTIGE_TEXT.buy,
      ariaLabel: `${def.name}, ${statusText}, ${def.cost}`,
      slot: spriteFor(PRESTIGE_ART.perkSlot, PRESTIGE_ART.slot[status], PRESTIGE_ART.slotFrame, SLOT_FRAMES),
      icon: spriteFor(PRESTIGE_ART.perks, def.icon, PRESTIGE_ART.perkFrame, PERK_FRAMES),
    };
  });

  return {
    empty,
    message: empty ? PRESTIGE_TEXT.empty : '',
    // echo.png is one 32 px frame (same size as a perk frame).
    echo: spriteFor(PRESTIGE_ART.echo, 0, PRESTIGE_ART.perkFrame, 1),
    echoesText: `${PRESTIGE_TEXT.echoes} ${prestige.echoesEarned} (+${pct}% ${PRESTIGE_TEXT.allPerSecond})`,
    unspentText: `${PRESTIGE_TEXT.unspent} ${unspent}`,
    cycleText: cycleLabel(prestige.cycle),
    nextCycleText: revealed
      ? `${PRESTIGE_TEXT.nextCycle}: ${preview.label} · +${preview.echoesGained} ${PRESTIGE_TEXT.echoes}`
      : null,
    cards,
  };
}
