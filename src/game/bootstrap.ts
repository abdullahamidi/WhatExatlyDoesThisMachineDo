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
import { createGuidance } from '../ui/guidance';
import { createEraCards } from '../ui/eraCard';
import { prestigeUiVisible } from '../ui/systemMenuModel';
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
import type { DemoEnd } from '../ui/demoEnd';
import { setRevealed } from '../ui/revealRules';
import { bindHotkeys } from '../ui/hotkeys';
import { uiRootAttrs } from '../ui/menu/settingsView';
import { createSettingsPanel } from '../ui/menu/settingsPanel';
import { createStatsPanel } from '../ui/menu/statsPanel';
import { createAchievementsPanel } from '../ui/menu/achievementsPanel';
import { editionAchievements } from '../ui/menu/achievementsView';
import { createMemoryPanel } from '../ui/menu/memoryPanel';
import { createDataPanel } from '../ui/menu/dataPanel';
import { setDefaultNotation } from '../utils/format';
import { createGameAudio } from '../audio/gameAudio';
import { isFinaleLocked, isRevealed } from '../simulation';
import { VIEW } from '../data/world';
import { PALETTE_CSS } from '../data/palette';
import { EDITIONS, capReached } from '../data/edition';
import type { Edition } from '../data/edition';
import { SHOWCASE_TEASER } from '../data/showcase';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { ShowcaseScene } from './scenes/ShowcaseScene';
import { installDebugHook } from './debugHook';

// Composition root. Boot: load the save (offline progress applied once, then written back), build the
// UI and modal stack, start autosave and unload saves, then the audio controller and the Phaser game.
// Reset only runs through the save controller. Recovered-save and welcome-back toasts come from the
// StartupResult, because the boot 'offline' event fires before any listener exists.
// WP19: the desktop host (when present) supplies the save storage, the title screen holds the boot notices until
// it closes, the crash overlay saves through the same controller, and the UI root follows the canvas viewport.
// WP21: the edition (main.ts, from the build mode) sets the era cap, the demo-aware panels and the lazy END OF DEMO module.
/** One disposer for several session subscriptions. */
function joinUnsubscribes(...unsubscribes: Array<() => void>): () => void {
  return () => {
    for (const off of unsubscribes) off();
  };
}

export interface BootOptions {
  /** default EDITIONS.full; main.ts passes the build mode's edition */
  edition?: Edition;
  /** Demo builds only: loads the END OF DEMO module. Absent in the full build, so its code never ships there. */
  loadDemoEnd?: () => Promise<typeof import('../ui/demoEnd')>;
  /** default window.location.search */
  search?: string;
}

export function bootstrap(opts: BootOptions = {}): Phaser.Game {
  const search = opts.search ?? window.location.search;
  const edition = opts.edition ?? EDITIONS.full;
  const host = getHost(window);
  const picked = pickStorage({ host, legacy: browserStorage });
  const saveManager = new SaveManager(picked.storage);
  const startup = startSession(saveManager, Date.now(), undefined, { maxEra: edition.maxEra });
  const session = startup.session;
  // WP21: the demo end module arrives late (lazy chunk); until then the boot check waits.
  let demoEnd: DemoEnd | null = null;
  let demoBootPending = true;
  // The stored save did not own the cap tech, but the boot catch-up crossed it: the teaser plays, not a plain card.
  const capJustReached = edition.capTech !== null
    && startup.load.state.techLevels[edition.capTech] < 1
    && session.state.techLevels[edition.capTech] >= 1;
  const version = versionLine(APP_VERSION, SAVE_VERSION, edition.label);
  const versionAria = versionAriaLabel(APP_VERSION, edition.label);

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
  // WP20: HUD guidance (next goal, TECH INDEX hint, affordable badge) and era cards. Page-lifetime, like the HUD and toasts.
  createGuidance(root, { session, techTree });
  createEraCards(root, { session, techTree });

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
        cycleRelevant: () => !edition.demo && prestigeUiVisible(session.state.ending.phase, session.prestige.cycle),
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
        rowOptions: { hideCycles: edition.demo, maxEra: edition.maxEra },
      }),
    },
    {
      id: MENU_TABS.records.id,
      label: MENU_TABS.records.label,
      mount: (host) => createAchievementsPanel(host, {
        getUnlocked: () => session.achievements,
        subscribe: (fn) => joinUnsubscribes(session.on('achievement', fn), session.on('reset', fn)),
        defs: editionAchievements(edition.maxEra),
      }),
    },
    {
      id: MENU_TABS.memory.id,
      label: MENU_TABS.memory.label,
      visible: () => !edition.demo && prestigeUiVisible(session.state.ending.phase, session.prestige.cycle),
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
    demoEnding: edition.demo
      ? { reached: () => demoEnd !== null && capReached(session.state.techLevels, edition.capTech), open: () => demoEnd?.openCard() }
      : undefined,
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
      if (isFinaleLocked(session.state.ending) || newCycleHoldsKeys() || shellHoldsKeys() || demoEnd?.isBusy() === true) return;
      if (techTree.isOpen()) techTree.close();
      else ctx.commands.openTechTree.emit();
    },
    openMenu: () => {
      if (isFinaleLocked(session.state.ending) || newCycleHoldsKeys() || shellHoldsKeys() || demoEnd?.isBusy() === true) return;
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

  // WP21: the demo end is decided once the World is up and no title blocks: cap owned -> card (or the teaser when the boot catch-up crossed the cap).
  const runDemoBoot = (): void => {
    if (!demoBootPending || demoEnd === null || modals.has(TITLE_STACK_ID)) return;
    if (game === null || !game.scene.isActive('World')) {
      window.setTimeout(runDemoBoot, 100);
      return;
    }
    demoBootPending = false;
    demoEnd.bootCheck({ teaser: capJustReached });
  };

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
      runDemoBoot();
    },
    openSettings: () => systemMenu.open(MENU_TABS.settings.id),
    openCredits: () => credits.open(),
    quit: () => quitToDesktop?.(),
  });
  if (shouldShowTitle({ search, phase: session.state.ending.phase })) title.open();
  else {
    showBootNotices();
    runDemoBoot();
  }

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
  // Demo builds only: the END OF DEMO module loads after the game exists; its teaser drives the World scene.
  if (edition.demo && opts.loadDemoEnd) {
    opts.loadDemoEnd().then((m) => {
      demoEnd = m.createDemoEnd(root, {
        session, edition, modals,
        teaser: {
          play: (onDone) => { if (game !== null) ShowcaseScene.play(game, { settings: session.settings, plateMaxTech: edition.capTech ?? undefined, onDone }); },
          skipToEnd: () => { if (game !== null) ShowcaseScene.ensure(game).seek(SHOWCASE_TEASER.endS); },
          stop: () => { if (game !== null) ShowcaseScene.stop(game); },
        },
        closeDialogs: () => { techTree.close(); systemMenu.close(); },
        blocked: () => shellHoldsKeys() || newCycleHoldsKeys(),
        openUrl: (url) => { if (host !== null) host.openExternal(url); else window.open(url, '_blank', 'noopener,noreferrer'); },
        desktop: host !== null,
        quit: quitToDesktop,
      });
      runDemoBoot();
    }, (err) => console.error('[demo] end module failed to load', err));
  }
  // The debug hook is test-only: never with a packaged desktop host, and only with ?debug or a dev build.
  if (debugEnabled(search, import.meta.env.DEV) && host?.isPackaged !== true) {
    installDebugHook(session, game, techTree, {
      modals, systemMenu, saveController, audio, newCycle,
      demo: () => demoEnd?.debugState() ?? null,
    });
  }
  return game;
}
