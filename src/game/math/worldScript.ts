// Living world script types (WP23b): one frame of the finale film, the KEEP and postgame clocks and the postgame loop, as plain data
// that the renderers draw (LivingWorld.setScript, WorldProps.setScript). Why: the film is a pure function of the clock
// (worldFinale.ts), so the renderers never own the timing and the director only forwards each frame through the port.
// Pure types: no Phaser, no DOM. Rows are sheet rows (0-4 eras I-V, 5 whole). Times are seconds of the finale clock unless named.
import type { WorldRow } from '../../data/livingWorld';
import type { EndingPhase } from '../../data/types';

export type ScriptCastId = 'inspector' | 'dog' | 'crow' | 'girl' | 'sensor7';

// One cast member in one frame. dx / dy: world px from WORLD_ENDING.homeX and the member's home feet line (the crow: from its perch,
// feet at row y - crowPerchLiftArtPx * 2). flip true = faces left. blend: 0..1 opacity of blendRow drawn over row (crossfade).
export interface CastScriptPose {
  visible: boolean;
  frame: string;            // frame name on the cast sheet
  row: number;              // sheet row 0..5
  blendRow: number | null;  // crossfaded row, or null
  blend: number;
  dx: number;
  dy: number;
  flip: boolean;
  alpha: number;
  shadow: boolean;
  worldRow?: WorldRow;      // the row the body and shadow draw on when it differs from the placement row (postgame pat); else undefined
}

// Prop states of one frame. Stage values are the state before the restore; stage is also the default of the film readouts.
export interface PropScript {
  windowsAlpha: number;        // six lit windows and halo: 1 - trackValue('skyline')
  virgaAlpha: number;          // 1 - trackValue('mountains')
  chladniAlpha: number;        // 1 until FINALE_DUST.reverseAtS, then linear to 0 over FINALE_DUST.reverseS
  girlWindow: 'stage' | 'restored';   // restored from LAST LOOK on and in the postgame
  lamp: 'stage' | 'restored';
  lampGlow: 'stage' | 'warm';
  clock: 'ruin' | 'restored';
  secondHandDeg: number | null;       // degrees clockwise from 12; null until the clock restores; 6 degrees a second afterwards
  booth: 'stage' | 'dark' | 'restored' | 'blink';
  receiver: 'stage' | 'onHook';
  sensorLed: 'stage' | 'dead' | 'green';
  sensorGlyph: 'stage' | 'dash' | 'one';
  sprout: 'stage' | 'bloom';
  puddles: 'stage' | 'whole';
  chain: 'stage' | 'fallen';
  hole: 'stage' | 'hidden';
  lantern: 'none' | 'fallen';
  redBall: boolean;
  motes: 'stage' | 'moth';
  marksPlus: 0 | 1;                   // the extra tally mark the crow pecks in on KEEP
}

// The whole crow frame drawn by the first bird of the flock while the world crow is out of view.
export interface CrowLead { frame: string; row: number }

export interface WorldScriptFrame {
  t: number;
  phase: 'sequence' | 'choice' | 'postgame';
  lastLook: boolean;          // the LAST LOOK pose set is on
  keepS: number | null;       // seconds since KEEP IT RUNNING; null before KEEP; Infinity when the session booted into postgame
  cast: Record<ScriptCastId, CastScriptPose>;
  props: PropScript;
  lead: CrowLead | null;
}

export interface WorldFinalePortInput { phase: EndingPhase; t: number; reduced: boolean }
export interface WorldFinaleResult { lead: CrowLead | null }
export interface WorldFinalePort { applyFinale(i: WorldFinalePortInput): WorldFinaleResult }
