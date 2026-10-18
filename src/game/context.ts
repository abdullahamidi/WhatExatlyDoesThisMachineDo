import type { GameSession } from '../simulation';
import type { Signal } from '../utils/signal';

export interface GameCommands { refocus: Signal<void>; openTechTree: Signal<void> }
export interface GameContext { session: GameSession; commands: GameCommands }
