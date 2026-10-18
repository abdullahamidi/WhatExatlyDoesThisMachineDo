import Phaser from 'phaser';
import type { GameContext } from './context';
import type { PurchaseFailure } from '../data/types';
import type { MachineComponentId } from '../data/machineComponents';
import { createSignal } from '../utils/signal';
import { SaveManager, browserStorage } from '../persistence/saveManager';
import { startSession } from '../persistence/startup';
import { createSaveController } from '../persistence/saveController';
import { createModalStack, bindEscapeToStack } from '../ui/modalStack';
import { createHud } from '../ui/hud';
import { createToasts, connectNotifications, connectOfflineNotices } from '../ui/toasts';
import { connectSystemLog } from '../ui/systemLog';
import { recoveredMessage, welcomeBackMessage } from '../ui/notificationRules';
import { createTechTree } from '../ui/techTree';
import { createSystemMenu } from '../ui/systemMenu';
import { createGameAudio } from '../audio/gameAudio';
import { VIEW } from '../data/world';
import { PALETTE_CSS } from '../data/palette';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { installDebugHook } from './debugHook';

// Composition root. Boot: load the save (offline progress applied once, then written back), build the
// UI and modal stack, start autosave and unload saves, then the audio controller and the Phaser game.
// Reset only runs through the save controller. Recovered-save and welcome-back toasts come from the
// StartupResult, because the boot 'offline' event fires before any listener exists.
export function bootstrap(): Phaser.Game {
  const saveManager = new SaveManager(browserStorage());
  const startup = startSession(saveManager, Date.now());
  const session = startup.session;

  // One Escape listener for the whole page lifetime; it closes only the top-most modal.
  const modals = createModalStack();
  bindEscapeToStack(modals, window);

  const ctx: GameContext = {
    session,
    commands: { refocus: createSignal(), openTechTree: createSignal(), openSystemMenu: createSignal(), crank: createSignal() },
    feedback: { purchaseDenied: createSignal<PurchaseFailure>(), partLanded: createSignal<MachineComponentId>() },
    modals,
  };

  const root = document.getElementById('ui-root');
  if (!root) throw new Error('#ui-root missing');
  const hud = createHud(root, ctx.commands);
  const toasts = createToasts(root);
  session.on('reset', () => toasts.clear());
  const techTree = createTechTree(root, ctx);

  const saveController = createSaveController({ session, saveManager });
  saveController.start();

  const systemMenu = createSystemMenu(root, {
    isMuted: () => session.settings.muted,
    setMuted: (m) => session.setMuted(m),
    saveNow: () => saveController.saveNow(),
    resetProgress: () => saveController.resetProgress(),
    modals,
  });
  // The two dialogs are mutually exclusive: opening one closes the other.
  ctx.commands.openSystemMenu.on(() => {
    techTree.close();
    systemMenu.open();
  });
  ctx.commands.openTechTree.on(() => systemMenu.close());

  // Boot-time notices. Shown once here; later offline reports (tab return) use connectOfflineNotices.
  if (startup.load.status === 'recovered') toasts.show(recoveredMessage());
  const welcome = welcomeBackMessage(startup.offline);
  if (welcome !== null) toasts.show(welcome);
  connectNotifications(session, toasts);
  connectOfflineNotices(session, toasts);
  connectSystemLog(session, toasts);

  // Unload saves: the tab may be closed before the next autosave tick.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveController.saveNow();
  });
  window.addEventListener('pagehide', () => {
    saveController.saveNow();
  });
  window.addEventListener('beforeunload', () => {
    saveController.saveNow();
  });

  // Creates no AudioContext here; the first gesture does.
  const audio = createGameAudio(session, ctx.feedback, window);

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
    audio: { noAudio: true },
    scene: [new BootScene(), new WorldScene(ctx, { hud, techTree, modals })],
  });
  installDebugHook(session, game, techTree, { modals, systemMenu, saveController, audio });
  return game;
}
