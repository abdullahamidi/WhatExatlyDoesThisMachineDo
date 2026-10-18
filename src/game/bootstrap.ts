import Phaser from 'phaser';
import { GameSession, createInitialState } from '../simulation';
import type { GameContext } from './context';
import { createSignal } from '../utils/signal';
import { createHud } from '../ui/hud';
import { VIEW } from '../data/world';
import { PALETTE_CSS } from '../data/palette';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { installDebugHook } from './debugHook';

// Composition root: builds the session (offline progress applied before the loop), the HUD and the Phaser game.
export function bootstrap(): Phaser.Game {
  const session = new GameSession({ state: createInitialState(Date.now()) });
  session.applyOffline();

  const ctx: GameContext = { session, commands: { refocus: createSignal(), openTechTree: createSignal() } };

  const root = document.getElementById('ui-root');
  if (!root) throw new Error('#ui-root missing');
  const hud = createHud(root, ctx.commands);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: VIEW.width,
    height: VIEW.height,
    backgroundColor: PALETTE_CSS.ink,
    pixelArt: true,
    roundPixels: true,
    input: { mouse: { preventDefaultWheel: true } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [new BootScene(), new WorldScene(ctx, hud)],
  });
  installDebugHook(session, game);
  return game;
}
