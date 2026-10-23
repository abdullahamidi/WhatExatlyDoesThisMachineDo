// Types only (WP18): what the machine renderers read instead of GameSession, so a display wrapper can stand in for the real session.
import type { GameSession } from '../../simulation';
import type { ResourceMap, SettingsState, TechId } from '../../data/types';
import type { GameFeedback } from '../context';

/** What the machine renderers read. GameSession and GameContext satisfy it structurally; DisplaySource / StandInSource implement it. */
export interface MachineSource {
  readonly state: { readonly techLevels: Readonly<Record<TechId, number>> };
  readonly rates: { readonly perSecond: Readonly<ResourceMap> };
  readonly settings: Readonly<SettingsState>;
  on: GameSession['on'];
}

export interface MachineViewContext { session: MachineSource; feedback: Pick<GameFeedback, 'partLanded'> }
