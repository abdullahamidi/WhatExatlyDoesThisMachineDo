import type { GameSession } from '../simulation';
import type { Signal } from '../utils/signal';
import type { PurchaseFailure } from '../data/types';
import type { MachineComponentId } from '../data/machineComponents';
import type { ModalStack } from '../ui/modalStack';
import type { FinaleBeat } from '../data/finale';
import type { NewCycleHook } from './newCycle';
import type { TechId } from '../data/types';

export interface GameCommands { refocus: Signal<void>; openTechTree: Signal<void>; openSystemMenu: Signal<void>; crank: Signal<void>; clearFault: Signal<void> }
/** WP22: a part track crossed a visual tier (one per played beat or staged change). */
export interface PartEvolvedEvent { techId: TechId; fromTier: number; toTier: number; topTier: number; hosts: readonly MachineComponentId[] }
/** WP22: a level bought between two tiers (small torque spark + tick). */
export interface PartTorquedEvent { techId: TechId; host: MachineComponentId; step: number }
/**
 * WP23a: one living-world audio cue. blip = a speech blip from a speaker (count, reversed for the reply);
 * ring = the payphone ring; dialTone = the payphone dial tone switching on or off.
 * Speaker ids are spelled out here (no import from data/livingWorld) so this file stays a leaf.
 */
export type WorldSound =
  | { kind: 'blip'; speaker: 'inspector' | 'dog' | 'crow' | 'girl' | 'payphone'; count: number; reversed: boolean }
  | { kind: 'ring' }
  | { kind: 'dialTone'; on: boolean };
/** WP26: the weather the living world shows this frame. A plain mutable readout (not a Signal): only LivingWorldDirector writes it, only gameAudio reads it. */
export interface WorldWeather { live: boolean; wind: number; virgaAlpha: number; virgaSpeed: number }
export interface GameFeedback {
  purchaseDenied: Signal<PurchaseFailure>; partLanded: Signal<MachineComponentId>; finaleBeat: Signal<FinaleBeat>;
  partEvolved: Signal<PartEvolvedEvent>; partTorqued: Signal<PartTorquedEvent>;
  worldSound: Signal<WorldSound>;
  worldWeather: WorldWeather;
}
export interface GameContext { session: GameSession; commands: GameCommands; feedback: GameFeedback; modals: ModalStack; newCycle: NewCycleHook }
