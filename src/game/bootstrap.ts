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
import { createToasts, connectNotifications, connectAchievements, connectOfflineNotices } from '../ui/toasts';
import { connectSystemLog } from '../ui/systemLog';
import { recoveredMessage, welcomeBackMessage } from '../ui/notificationRules';
import { createTechTree } from '../ui/techTree';
import { createSystemMenu } from '../ui/systemMenu';
import type { SystemMenuPanel } from '../ui/systemMenu';
import { bindHotkeys } from '../ui/hotkeys';
import { uiRootAttrs } from '../ui/menu/settingsView';
import { createSettingsPanel } from '../ui/menu/settingsPanel';
import { createStatsPanel } from '../ui/menu/statsPanel';
import { createAchievementsPanel } from '../ui/menu/achievementsPanel';
import { createDataPanel } from '../ui/menu/dataPanel';
import { setDefaultNotation } from '../utils/format';
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
/** One disposer for several session subscriptions. */
function joinUnsubscribes(...unsubscribes: Array<() => void>): () => void {
  return () => {
    for (const off of unsubscribes) off();
  };
}

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

  // D9: a brand-new save starts with reduced motion when the OS asks for it. Read here only.
  if (startup.load.status === 'new' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true) {
    session.updateSettings({ reducedMotion: true });
  }
  // Settings applier: once now and on every 'settings' event. Notation is the module default read by the
  // formatters; UI scale and the marker / motion flags are root attributes the CSS reads.
  const applySettings = (): void => {
    const s = session.settings;
    setDefaultNotation(s.notation);
    const attrs = uiRootAttrs(s);
    root.style.zoom = attrs.zoom;
    root.dataset.statusMarkers = attrs.statusMarkers;
    root.dataset.reducedMotion = attrs.reducedMotion;
  };
  applySettings();
  session.on('settings', applySettings);

  // SYSTEM menu tabs after SYSTEM. Each panel reaches the game only through its narrow deps.
  // Tab labels: UI text that belongs in src/data/systemMenu.ts (MENU_TABS); kept here until that file is open.
  const panels: readonly SystemMenuPanel[] = [
    {
      id: 'settings',
      label: 'SETTINGS',
      mount: (host) => createSettingsPanel(host, {
        get: () => session.settings,
        update: (patch) => session.updateSettings(patch),
        subscribe: (fn) => session.on('settings', () => fn()),
      }),
    },
    {
      id: 'stats',
      label: 'STATS',
      mount: (host) => createStatsPanel(host, {
        getStats: () => session.stats,
        subscribe: (fn) => joinUnsubscribes(
          session.on('click', fn),
          session.on('purchase', fn),
          session.on('offline', fn),
          session.on('reset', fn),
        ),
      }),
    },
    {
      id: 'records',
      label: 'RECORDS',
      mount: (host) => createAchievementsPanel(host, {
        getUnlocked: () => session.achievements,
        subscribe: (fn) => joinUnsubscribes(session.on('achievement', fn), session.on('reset', fn)),
      }),
    },
    {
      id: 'data',
      label: 'DATA',
      mount: (host) => createDataPanel(host, {
        exportString: () => saveController.exportString(),
        importString: (text) => saveController.importString(text),
        reload: () => window.location.reload(),
        modals,
      }),
    },
  ];

  const systemMenu = createSystemMenu(root, {
    isMuted: () => session.settings.muted,
    setMuted: (m) => session.setMuted(m),
    saveNow: () => saveController.saveNow(),
    resetProgress: () => saveController.resetProgress(),
    modals,
    panels,
  });
  // The two dialogs are mutually exclusive: opening one closes the other.
  ctx.commands.openSystemMenu.on(() => {
    techTree.close();
    systemMenu.open();
  });
  ctx.commands.openTechTree.on(() => systemMenu.close());

  // Global keys (T, Space / Enter crank, Escape opens the menu). Editable fields keep their keys.
  bindHotkeys(window, {
    modals,
    crank: () => ctx.commands.crank.emit(),
    toggleTechTree: () => {
      if (techTree.isOpen()) techTree.close();
      else ctx.commands.openTechTree.emit();
    },
    openMenu: () => ctx.commands.openSystemMenu.emit(),
  });

  // Boot-time notices. Shown once here; later offline reports (tab return) use connectOfflineNotices.
  if (startup.load.status === 'recovered') toasts.show(recoveredMessage());
  const welcome = welcomeBackMessage(startup.offline);
  if (welcome !== null) toasts.show(welcome);
  connectNotifications(session, toasts);
  connectAchievements(session, toasts);
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
