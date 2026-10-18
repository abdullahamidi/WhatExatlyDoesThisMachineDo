// Rare system log lines shown as toasts (WP4). Pure data: no logic lives in this file.
// Tone follows GAME_SPEC §10: cryptic, procedural, no explanations.

// Condition that makes a log eligible. playSeconds = (now - createdAt) / 1000.
export type SystemLogTrigger =
  | { kind: 'lifetimeMe'; atLeast: number }
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
  { id: 'unlabeled-part', text: 'Unlabeled component detected in intake. Ignored.', trigger: { kind: 'lifetimeMe', atLeast: 25 } },
  { id: 'vibration-baseline', text: 'Vibration baseline drifted. Source: internal.', trigger: { kind: 'playSeconds', atLeast: 300 } },
  { id: 'sensor-null', text: 'Sensor 7 reports nothing. Reading accepted.', trigger: { kind: 'lifetimeMe', atLeast: 120 } },
  { id: 'schedule-gap', text: 'Scheduled maintenance missed. Continuing.', trigger: { kind: 'playSeconds', atLeast: 600 } },
  { id: 'output-ledger', text: 'Output ledger balanced. Recipient: not specified.', trigger: { kind: 'lifetimeMe', atLeast: 600 } },
  { id: 'power-draw', text: 'Power draw matches a load that is not present.', trigger: { kind: 'playSeconds', atLeast: 1200 } },
  { id: 'chamber-seal', text: 'Chamber seal inspected. Inspector not logged.', trigger: { kind: 'lifetimeMe', atLeast: 2500 } },
  { id: 'idle-cycle', text: 'Idle cycle logged. Cycle has no beginning.', trigger: { kind: 'playSeconds', atLeast: 2400 } },
];

// Scheduler settings: minGapMs between two logs, poll interval, toast time on screen.
export const SYSTEM_LOG_CONFIG = { minGapMs: 120000, checkIntervalMs: 5000, durationMs: 5000 } as const;

export const SYSTEM_LOG_TITLE = 'SYS LOG';
