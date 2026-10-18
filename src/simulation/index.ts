// Public surface of the simulation layer. Pure modules only: no Phaser, no DOM, no persistence.
export { GameSession } from './GameSession';
export type { GameSessionOptions, ReadonlyGameState } from './GameSession';
export { TypedEmitter } from './events';
export type { Listener, SessionEvents } from './events';
export { DEFAULT_SETTINGS, createInitialState } from './state';
export { costAt, canAfford } from './economy/cost';
export { computeRates } from './production/rates';
export { applyClick, advance, computeOffline, applyOffline } from './production/tick';
export { isRequirementMet, requirementsMet, requirementLabel } from './progression/requirements';
export { getTechStatus, getTechView, getAllTechViews } from './progression/status';
export { purchase } from './progression/purchase';
export { evaluateMilestones } from './progression/milestones';
