import type { GameSession } from '../simulation';
import type { Signal } from '../utils/signal';
import type { PurchaseFailure } from '../data/types';
import type { MachineComponentId } from '../data/machineComponents';
import type { ModalStack } from '../ui/modalStack';

export interface GameCommands { refocus: Signal<void>; openTechTree: Signal<void>; openSystemMenu: Signal<void>; crank: Signal<void> }
export interface GameFeedback { purchaseDenied: Signal<PurchaseFailure>; partLanded: Signal<MachineComponentId> }
export interface GameContext { session: GameSession; commands: GameCommands; feedback: GameFeedback; modals: ModalStack }
