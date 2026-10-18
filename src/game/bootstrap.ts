import Phaser from 'phaser';
import type { GameContext } from './context';
import type { PurchaseFailure } from '../data/types';
import type { FinaleBeat } from '../data/finale';
import type { MachineComponentId } from '../data/machineComponents';
import { createNewCycleController } from './newCycle';
import { MENU_TABS } from '../data/systemMenu';
import { createSignal } from '../utils/signal';
import { SaveManager, browserStorage } from '../persistence/saveManager';
import { startSession } from '../persistence/startup';
import { createSaveController } from '../persistence/saveController';
import { createModalStack, bindEscapeToStack } from '../ui/modalStack';
import { createHud } from '../ui/hud';
import { createToasts, connectNotifications, connectAchievements, connectOfflineNotices, connectCycleNotices } from '../ui/toasts';
import { connectSystemLog } from '../ui/systemLog';
import { recoveredMessage, welcomeBackMessage } from '../ui/notificationRules';
import { createTechTree } from '../ui/techTree';
import { createSystemMenu } from '../ui/systemMenu';
import type { SystemMenuPanel } from '../ui/systemMenu';
import { createFinaleOverlay } from '../ui/finale';
import { createCycleConfirm } from '../ui/cycleConfirm';
import { setRevealed } from '../ui/revealRules';
import { bindHotkeys } from '../ui/hotkeys';
import { uiRootAttrs } from '../ui/menu/settingsView';
import { createSettingsPanel } from '../ui/menu/settingsPanel';
import { createStatsPanel } from '../ui/menu/statsPanel';
import { createAchievementsPanel } from '../ui/menu/achievementsPanel';
import { createMemoryPanel } from '../ui/menu/memoryPanel';
import { createDataPanel } from '../ui/menu/dataPanel';
import { setDefaultNotation } from '../utils/format';
import { createGameAudio } from '../audio/gameAudio';
import { isFinaleLocked, isRevealed } from '../simulation';
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

  const root = document.getElementById('ui-root');
  if (!root) throw new Error('#ui-root missing');

  // New cycle (WP14): the controller replaces the WP13 stub. The transition port is late-bound (WorldScene sets it
  // when the scene starts; before that the transition is a plain swap). closeDialogs reads the tech tree and menu
  // declared below; it runs only on a player action, after both exist.
  const cycleLink = {
    play: (onPeak: () => void, onDone: () => void): void => {
      onPeak();
      onDone();
    },
  };
  const cycleConfirm = createCycleConfirm(root, { modals });
  const newCycle = createNewCycleController({
    session,
    now: () => Date.now(),
    confirm: (preview, onConfirm) => cycleConfirm.open(preview, onConfirm),
    playTransition: (onPeak, onDone) => cycleLink.play(onPeak, onDone),
    closeDialogs: () => {
      techTree.close();
      systemMenu.close();
    },
  });
  // Hotkeys and the menu stay shut while a cycle transition runs or its confirm dialog is up (EM decision 4).
  const newCycleHoldsKeys = (): boolean => newCycle.isBusy() || modals.has('cycleConfirm');

  const ctx: GameContext = {
    session,
    commands: { refocus: createSignal(), openTechTree: createSignal(), openSystemMenu: createSignal(), crank: createSignal() },
    feedback: { purchaseDenied: createSignal<PurchaseFailure>(), partLanded: createSignal<MachineComponentId>(), finaleBeat: createSignal<FinaleBeat>() },
    modals,
    newCycle,
  };

  // The xf label reads RF from the choice on (D6). Set at boot and whenever the ending changes or resets.
  const syncReveal = (): void => setRevealed(isRevealed(session.state.ending));
  syncReveal();
  session.on('ending', syncReveal);
  session.on('reset', syncReveal);
  const hud = createHud(root, ctx.commands);
  const toasts = createToasts(root);
  session.on('reset', () => toasts.clear());
  const techTree = createTechTree(root, ctx);

  const saveController = createSaveController({ session, saveManager });
  saveController.start();

  // D9: a brand-new save starts with reduced motion when the OS asks for it. Read here only.
  // Skipped after a read error: the 'settings' save would overwrite a possibly good stored save.
  if (
    startup.load.status === 'new' &&
    startup.load.error === undefined &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true
  ) {
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
  const panels: readonly SystemMenuPanel[] = [
    {
      id: MENU_TABS.settings.id,
      label: MENU_TABS.settings.label,
      mount: (host) => createSettingsPanel(host, {
        get: () => session.settings,
        update: (patch) => session.updateSettings(patch),
        subscribe: (fn) => session.on('settings', () => fn()),
      }),
    },
    {
      id: MENU_TABS.stats.id,
      label: MENU_TABS.stats.label,
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
      id: MENU_TABS.records.id,
      label: MENU_TABS.records.label,
      mount: (host) => createAchievementsPanel(host, {
        getUnlocked: () => session.achievements,
        subscribe: (fn) => joinUnsubscribes(session.on('achievement', fn), session.on('reset', fn)),
      }),
    },
    {
      id: MENU_TABS.memory.id,
      label: MENU_TABS.memory.label,
      mount: (host) => createMemoryPanel(host, {
        // Thin adapter: the panel listens to three events, with no payload it needs.
        session: {
          get prestige() {
            return session.prestige;
          },
          on: (type, fn) => session.on(type, () => fn()),
        },
        preview: newCycle.preview,
        buyPerk: (id) => {
          session.buyPerk(id);
        },
        revealed: () => isRevealed(session.state.ending),
      }),
    },
    {
      id: MENU_TABS.data.id,
      label: MENU_TABS.data.label,
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
    ending: { phase: () => session.state.ending.phase, newCycle: ctx.newCycle },
  });
  // The two dialogs are mutually exclusive: opening one closes the other.
  ctx.commands.openSystemMenu.on(() => {
    techTree.close();
    systemMenu.open();
  });
  ctx.commands.openTechTree.on(() => systemMenu.close());

  // Finale overlay (WP13). Skip goes to the live director (WorldScene points finaleLink at it); KEEP writes the
  // ending phase; the new-cycle button calls the hook only when it is not blocked.
  const finaleLink = { skip: (): void => undefined };
  const finaleOverlay = createFinaleOverlay(root, {
    modals,
    newCycle: ctx.newCycle,
    closeDialogs: () => {
      techTree.close();
      systemMenu.close();
    },
    onSkip: () => finaleLink.skip(),
    onKeep: () => {
      session.keepRunning();
    },
    onNewCycle: () => {
      if (ctx.newCycle.blockedReason() === null) ctx.newCycle.begin();
    },
  });

  // Global keys (T, Space / Enter crank, Escape opens the menu). Editable fields keep their keys.
  // The tech tree and the menu stay shut while the finale runs (sequence / choice).
  bindHotkeys(window, {
    modals,
    crank: () => ctx.commands.crank.emit(),
    toggleTechTree: () => {
      if (isFinaleLocked(session.state.ending) || newCycleHoldsKeys()) return;
      if (techTree.isOpen()) techTree.close();
      else ctx.commands.openTechTree.emit();
    },
    openMenu: () => {
      if (isFinaleLocked(session.state.ending) || newCycleHoldsKeys()) return;
      ctx.commands.openSystemMenu.emit();
    },
  });

  // Boot-time notices. Shown once here; later offline reports (tab return) use connectOfflineNotices.
  if (startup.load.status === 'recovered') toasts.show(recoveredMessage());
  const welcome = welcomeBackMessage(startup.offline);
  if (welcome !== null) toasts.show(welcome);
  connectNotifications(session, toasts);
  connectAchievements(session, toasts);
  connectCycleNotices(session, toasts);
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
    scene: [new BootScene(), new WorldScene(ctx, { hud, techTree, modals, finaleOverlay, finaleLink, cycleLink })],
  });
  installDebugHook(session, game, techTree, { modals, systemMenu, saveController, audio, newCycle });
  return game;
}
