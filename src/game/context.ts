import type { GameSession } from '../simulation';
import type { Signal } from '../utils/signal';
import type { PurchaseFailure } from '../data/types';
import type { MachineComponentId } from '../data/machineComponents';
import type { ModalStack } from '../ui/modalStack';
import type { FinaleBeat } from '../data/finale';
import type { NewCycleHook } from './newCycle';

export interface GameCommands { refocus: Signal<void>; openTechTree: Signal<void>; openSystemMenu: Signal<void>; crank: Signal<void> }
export interface GameFeedback { purchaseDenied: Signal<PurchaseFailure>; partLanded: Signal<MachineComponentId>; finaleBeat: Signal<FinaleBeat> }
export interface GameContext { session: GameSession; commands: GameCommands; feedback: GameFeedback; modals: ModalStack; newCycle: NewCycleHook }
