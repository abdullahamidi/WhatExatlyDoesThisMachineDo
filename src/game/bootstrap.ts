import Phaser from 'phaser';
import type { GameContext } from './context';
import type { PurchaseFailure } from '../data/types';
import type { FinaleBeat } from '../data/finale';
import type { MachineComponentId } from '../data/machineComponents';
import type { ToastMessage } from '../data/notifications';
import { FRAME_RATE } from '../data/display';
import { APP_VERSION } from '../data/version';
import { createNewCycleController } from './newCycle';
import { MENU_TABS } from '../data/systemMenu';
import { createSignal } from '../utils/signal';
import { versionLine, versionAriaLabel } from '../utils/versionLine';
import { debugEnabled } from '../utils/debugFlag';
import { getHost } from '../platform/host';
import { SaveManager, browserStorage } from '../persistence/saveManager';
import { pickStorage } from '../persistence/hostStorage';
import { SAVE_VERSION } from '../persistence/schema';
import { startSession } from '../persistence/startup';
import { createSaveController } from '../persistence/saveController';
import { createModalStack, bindEscapeToStack } from '../ui/modalStack';
import { createHud } from '../ui/hud';
import { createToasts, connectNotifications, connectAchievements, connectOfflineNotices, connectCycleNotices } from '../ui/toasts';
import { connectSystemLog } from '../ui/systemLog';
import { achievementMessage, recoveredMessage, welcomeBackMessage } from '../ui/notificationRules';
import { createTechTree } from '../ui/techTree';
import { createSystemMenu } from '../ui/systemMenu';
import type { SystemMenuPanel } from '../ui/systemMenu';
import { createViewportSync } from '../ui/viewportSync';
import { createFullscreen } from '../ui/fullscreen';
import { createCredits, CREDITS_STACK_ID } from '../ui/credits';
import { createTitleScreen, TITLE_STACK_ID } from '../ui/titleScreen';
import { shouldShowTitle } from '../ui/titleModel';
import { showStorageWarning } from '../ui/storageWarning';
import { registerCrashSaver } from '../ui/crashOverlay';
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
// WP19: the desktop host (when present) supplies the save storage, the title screen holds the boot notices until
// it closes, the crash overlay saves through the same controller, and the UI root follows the canvas viewport.
/** One disposer for several session subscriptions. */
function joinUnsubscribes(...unsubscribes: Array<() => void>): () => void {
  return () => {
    for (const off of unsubscribes) off();
  };
}

export interface BootOptions {
  /** WP21 passes 'DEMO'. */
  editionLabel?: string | null;
  /** default window.location.search */
  search?: string;
}

export function bootstrap(opts: BootOptions = {}): Phaser.Game {
  const search = opts.search ?? window.location.search;
  const editionLabel = opts.editionLabel ?? null;
  const host = getHost(window);
  const picked = pickStorage({ host, legacy: browserStorage });
  const saveManager = new SaveManager(picked.storage);
  const startup = startSession(saveManager, Date.now());
  const session = startup.session;
  const version = versionLine(APP_VERSION, SAVE_VERSION, editionLabel);
  const versionAria = versionAriaLabel(APP_VERSION, editionLabel);

  // One Escape listener for the whole page lifetime; it closes only the top-most modal.
  const modals = createModalStack();
  bindEscapeToStack(modals, window);

  const root = document.getElementById('ui-root');
  if (!root) throw new Error('#ui-root missing');
  // Saves fall back to memory (no host, no usable localStorage): the banner says so.
  if (picked.kind === 'memory') showStorageWarning(root);

  // The UI root follows the game canvas rect. The game is created at the end of boot; until then the viewport
  // stands in with the base height.
  let game: Phaser.Game | null = null;
  const viewport = createViewportSync({ root, canvas: () => game?.canvas ?? null, uiScale: () => session.settings.uiScale });

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
  // The title and CREDITS modals keep the tech tree and menu hotkeys shut too (WP19).
  const shellHoldsKeys = (): boolean => modals.has(TITLE_STACK_ID) || modals.has(CREDITS_STACK_ID);

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
  // Every save path ends here: the controller write, then the host flush (a no-op for the browser storages).
  const flushSaves = (): void => {
    saveController.saveNow();
    picked.flush();
  };
  // The crash overlay saves through the same path; it reports success only when both writes worked.
  registerCrashSaver(() => {
    const ok = saveController.saveNow();
    const flushed = picked.flush();
    return ok && flushed;
  });
  // QUIT TO DESKTOP exists only with a host. Progress is flushed before the process exits.
  const quitToDesktop = host === null ? undefined : (): void => {
    flushSaves();
    host.quit();
  };

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
  // formatters; the UI scale (zoom, written by the viewport sync) and the marker / motion flags are root
  // attributes the CSS reads.
  const applySettings = (): void => {
    const s = session.settings;
    setDefaultNotation(s.notation);
    const attrs = uiRootAttrs(s);
    viewport.sync();
    root.dataset.statusMarkers = attrs.statusMarkers;
    root.dataset.reducedMotion = attrs.reducedMotion;
  };
  applySettings();
  session.on('settings', applySettings);

  // Session-only fullscreen: the host when present, the browser Fullscreen API otherwise (SETTINGS > DISPLAY row).
  const fullscreen = createFullscreen(host);

  // SYSTEM menu tabs after SYSTEM. Each panel reaches the game only through its narrow deps.
  const panels: readonly SystemMenuPanel[] = [
    {
      id: MENU_TABS.settings.id,
      label: MENU_TABS.settings.label,
      mount: (host) => createSettingsPanel(host, {
        get: () => session.settings,
        update: (patch) => session.updateSettings(patch),
        subscribe: (fn) => session.on('settings', () => fn()),
        fullscreen,
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

  // CREDITS modal: opened from the SYSTEM menu here and from the title screen.
  const credits = createCredits(root, { modals });
  const systemMenu = createSystemMenu(root, {
    isMuted: () => session.settings.muted,
    setMuted: (m) => session.setMuted(m),
    saveNow: () => saveController.saveNow(),
    resetProgress: () => saveController.resetProgress(),
    modals,
    panels,
    ending: { phase: () => session.state.ending.phase, newCycle: ctx.newCycle },
    quit: quitToDesktop,
    openCredits: () => credits.open(),
    footer: { text: version, ariaLabel: versionAria },
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
      if (isFinaleLocked(session.state.ending) || newCycleHoldsKeys() || shellHoldsKeys()) return;
      if (techTree.isOpen()) techTree.close();
      else ctx.commands.openTechTree.emit();
    },
    openMenu: () => {
      if (isFinaleLocked(session.state.ending) || newCycleHoldsKeys() || shellHoldsKeys()) return;
      ctx.commands.openSystemMenu.emit();
    },
  });

  // Boot-time notices. Queued and shown once: at once when the title is not shown, else when the title closes
  // (NEW GAME drops them). Later offline reports (tab return) use connectOfflineNotices.
  const bootNotices: ToastMessage[] = [];
  const showBootNotices = (): void => {
    for (const m of bootNotices.splice(0)) toasts.show(m);
  };
  if (startup.load.status === 'recovered') bootNotices.push(recoveredMessage());
  const welcome = welcomeBackMessage(startup.offline);
  if (welcome !== null) bootNotices.push(welcome);
  // Achievements the boot catch-up unlocked (WP15 T8): their listener ran before connectAchievements, so no repeat.
  if (startup.bootAchievements.length > 0) {
    const bootAchievements = achievementMessage(startup.bootAchievements);
    if (bootAchievements !== null) bootNotices.push(bootAchievements);
  }
  connectNotifications(session, toasts);
  connectAchievements(session, toasts);
  connectCycleNotices(session, toasts);
  connectOfflineNotices(session, toasts);
  connectSystemLog(session, toasts);

  // Title screen (WP19). Shown on a normal boot; the boot notices wait behind it. CONTINUE and Esc release them.
  // NEW GAME erases the save (when there is one) and drops the notices. Quit exists only on the desktop host.
  const hasSave = startup.load.status !== 'new';
  const title = createTitleScreen(root, {
    modals,
    hasSave,
    canQuit: quitToDesktop !== undefined,
    versionLine: version,
    versionAria,
    onClose: (result) => {
      if (result === 'newGame') {
        if (hasSave) saveController.resetProgress();
        bootNotices.length = 0;
      } else {
        showBootNotices();
      }
    },
    openSettings: () => systemMenu.open(MENU_TABS.settings.id),
    openCredits: () => credits.open(),
    quit: () => quitToDesktop?.(),
  });
  if (shouldShowTitle({ search, phase: session.state.ending.phase })) title.open();
  else showBootNotices();

  // Unload saves: the tab may be closed before the next autosave tick.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSaves();
  });
  window.addEventListener('pagehide', () => {
    flushSaves();
  });
  window.addEventListener('beforeunload', () => {
    flushSaves();
  });

  // Creates no AudioContext here; the first gesture does.
  const audio = createGameAudio(session, ctx.feedback, window);

  game = new Phaser.Game({
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
    fps: { target: FRAME_RATE.target, limit: FRAME_RATE.limit },
    disableContextMenu: true,
    scene: [new BootScene(), new WorldScene(ctx, { hud, techTree, modals, finaleOverlay, finaleLink, cycleLink })],
  });
  // The UI root re-fits when the game resizes and once the game is ready (the first sync may run before the canvas).
  game.scale.on(Phaser.Scale.Events.RESIZE, () => viewport.sync());
  game.events.once(Phaser.Core.Events.READY, () => viewport.sync());
  viewport.sync();
  // The debug hook is test-only: never with a packaged desktop host, and only with ?debug or a dev build.
  if (debugEnabled(search, import.meta.env.DEV) && host?.isPackaged !== true) {
    installDebugHook(session, game, techTree, { modals, systemMenu, saveController, audio, newCycle });
  }
  return game;
}
