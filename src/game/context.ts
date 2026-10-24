import type { GameSession } from '../simulation';
import type { Signal } from '../utils/signal';
import type { PurchaseFailure } from '../data/types';
import type { MachineComponentId } from '../data/machineComponents';
import type { ModalStack } from '../ui/modalStack';
import type { FinaleBeat } from '../data/finale';
import type { NewCycleHook } from './newCycle';
import type { TechId } from '../data/types';

export interface GameCommands { refocus: Signal<void>; openTechTree: Signal<void>; openSystemMenu: Signal<void>; crank: Signal<void> }
/** WP22: a part track crossed a visual tier (one per played beat or staged change). */
export interface PartEvolvedEvent { techId: TechId; fromTier: number; toTier: number; topTier: number; hosts: readonly MachineComponentId[] }
/** WP22: a level bought between two tiers (small torque spark + tick). */
export interface PartTorquedEvent { techId: TechId; host: MachineComponentId; step: number }
export interface GameFeedback {
  purchaseDenied: Signal<PurchaseFailure>; partLanded: Signal<MachineComponentId>; finaleBeat: Signal<FinaleBeat>;
  partEvolved: Signal<PartEvolvedEvent>; partTorqued: Signal<PartTorquedEvent>;
}
export interface GameContext { session: GameSession; commands: GameCommands; feedback: GameFeedback; modals: ModalStack; newCycle: NewCycleHook }
