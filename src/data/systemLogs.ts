// Rare system log lines shown as toasts (WP4). Pure data: no logic lives in this file.
// Tone follows GAME_SPEC §10: cryptic, procedural, no explanations.
import type { ResourceId } from './types';

// Condition that makes a log eligible. lifetime = lifetime[res]. playSeconds = (now - createdAt) / 1000.
export type SystemLogTrigger =
  | { kind: 'lifetime'; res: ResourceId; atLeast: number }
  | { kind: 'playSeconds'; atLeast: number };

export interface SystemLogEntry {
  id: string;
  text: string;
  trigger: SystemLogTrigger;
}

// Table order is the display order when several entries are eligible at once.
// Within each trigger kind the thresholds increase.
export const SYSTEM_LOGS: readonly SystemLogEntry[] = [
  { id: 'observer-count', text: 'Log 0041: observer count unchanged.', trigger: { kind: 'playSeconds', atLeast: 120 } },
  { id: 'unlabeled-part', text: 'Unlabeled component detected in intake. Ignored.', trigger: { kind: 'lifetime', res: 'me', atLeast: 500 } },
  { id: 'vibration-baseline', text: 'Vibration baseline drifted. Source: internal.', trigger: { kind: 'playSeconds', atLeast: 300 } },
  { id: 'sensor-null', text: 'Sensor 7 reports nothing. Reading accepted.', trigger: { kind: 'lifetime', res: 'me', atLeast: 5000 } },
  { id: 'schedule-gap', text: 'Scheduled maintenance missed. Continuing.', trigger: { kind: 'playSeconds', atLeast: 600 } },
  { id: 'output-ledger', text: 'Output ledger balanced. Recipient: not specified.', trigger: { kind: 'lifetime', res: 'me', atLeast: 30000 } },
  { id: 'power-draw', text: 'Power draw matches a load that is not present.', trigger: { kind: 'playSeconds', atLeast: 1200 } },
  { id: 'chamber-seal', text: 'Chamber seal inspected. Inspector not logged.', trigger: { kind: 'lifetime', res: 'me', atLeast: 100000 } },
  { id: 'idle-cycle', text: 'Idle cycle logged. Cycle has no beginning.', trigger: { kind: 'playSeconds', atLeast: 2400 } },
  { id: 'grid-handshake', text: 'Grid handshake sent. No grid answered.', trigger: { kind: 'lifetime', res: 'ee', atLeast: 1000 } },
  { id: 'load-beneath', text: 'Load detected 4 km beneath the surface.', trigger: { kind: 'lifetime', res: 'ee', atLeast: 100000 } },
  { id: 'manual-optional', text: 'Manual operation no longer required. Still detected.', trigger: { kind: 'lifetime', res: 'ee', atLeast: 500000 } },
  { id: 'copper-memory', text: 'Copper remembers a current older than the copper.', trigger: { kind: 'lifetime', res: 'ee', atLeast: 1000000 } },
  { id: 'pressure-rising', text: 'Pressure rising. Safe limit field left blank.', trigger: { kind: 'lifetime', res: 'pr', atLeast: 1000 } },
  { id: 'perimeter-umbrella', text: 'Umbrella detected. Precipitation: none.', trigger: { kind: 'lifetime', res: 'pr', atLeast: 100000 } },
  { id: 'steam-rain', text: 'Steam tastes of rain. Logged as error.', trigger: { kind: 'lifetime', res: 'pr', atLeast: 1000000 } },
  { id: 'sync-success', text: 'Synchronization successful.', trigger: { kind: 'lifetime', res: 'rs', atLeast: 1000 } },
  { id: 'signal-below', text: 'Frequency matches a signal from below the ground.', trigger: { kind: 'lifetime', res: 'rs', atLeast: 1000000 } },
  { id: 'perimeter-phase', text: 'Perimeter moving in phase. Not counted.', trigger: { kind: 'lifetime', res: 'rs', atLeast: 5000000 } },
  { id: 'observer-one', text: 'Observer count: 1.', trigger: { kind: 'lifetime', res: 'rs', atLeast: 20000000 } },
  { id: 'units-unknown', text: 'Units not recognized. Continuing.', trigger: { kind: 'lifetime', res: 'xf', atLeast: 1000 } },
  { id: 'cycle-0041', text: 'Cycle {cycle} nearly complete.', trigger: { kind: 'lifetime', res: 'xf', atLeast: 1000000 } },
  { id: 'operator-located', text: 'Operator identity: located.', trigger: { kind: 'lifetime', res: 'xf', atLeast: 100000000 } },
];

// Scheduler settings: minGapMs between two logs, poll interval, toast time on screen.
export const SYSTEM_LOG_CONFIG = { minGapMs: 120000, checkIntervalMs: 5000, durationMs: 5000 } as const;

export const SYSTEM_LOG_TITLE = 'SYS LOG';
