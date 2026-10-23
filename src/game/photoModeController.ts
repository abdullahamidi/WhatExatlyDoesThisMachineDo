import type { EndingPhase } from '../data/types';
import { PHOTO_MODE } from '../data/photoMode';
import type { ModalStack } from '../ui/modalStack';
import type { PhotoOverlay } from '../ui/photoMode';
import { canEnterPhoto } from '../ui/photoModeRules';
import type { CameraPose } from './math/finale';

// Photo mode (WP18) state: enter / exit, the 'photo' modal entry, camera and crank hand-off. Pure: no Phaser, no DOM.
// The scene wires the real camera, crank, overlay and modal stack through these ports.

export interface PhotoCamera {
  pose(): CameraPose;
  moveTo(pose: CameraPose): void;
  panBy(dxScreenPx: number, dyScreenPx: number): void;
  zoomStep(dir: 1 | -1): void;
}

export interface PhotoModeDeps {
  phase(): EndingPhase;
  modals: ModalStack;
  camera: PhotoCamera;
  crank: { setEnabled(on: boolean): void };
  overlay: Pick<PhotoOverlay, 'show' | 'hide' | 'hintVisible'>;
  /** Canonical portrait pose: photo entry and exit from postgame use it. */
  portrait(): CameraPose;
}

export interface PhotoModeController {
  enter(opts?: { force?: boolean; hint?: boolean }): boolean;
  exit(): void;
  /** Ends photo mode when another modal sits on top or the finale runs again. */
  update(): void;
  pan(dx: -1 | 0 | 1, dy: -1 | 0 | 1): void;
  zoom(dir: 1 | -1): void;
  isActive(): boolean;
  state(): { active: boolean; hint: boolean };
  destroy(): void;
}

export function createPhotoModeController(deps: PhotoModeDeps): PhotoModeController {
  let active = false;
  let entryPose: CameraPose | null = null;
  let entryPhase: EndingPhase = 'none';

  function exit(): void {
    if (!active) return;
    active = false;
    deps.modals.remove(PHOTO_MODE.modalId);
    deps.overlay.hide();
    deps.crank.setEnabled(true);
    // Postgame entries return to the portrait; a forced entry from another phase returns to where the camera was.
    const back = entryPhase === 'postgame' || entryPose === null ? deps.portrait() : entryPose;
    entryPose = null;
    deps.camera.moveTo(back);
  }

  function enter(opts?: { force?: boolean; hint?: boolean }): boolean {
    if (active) return false;
    if (!canEnterPhoto(deps.phase(), deps.modals.isOpen(), opts?.force ?? false)) return false;
    entryPose = deps.camera.pose();
    entryPhase = deps.phase();
    active = true;
    deps.modals.push(PHOTO_MODE.modalId, exit);
    deps.crank.setEnabled(false);
    deps.camera.moveTo(deps.portrait());
    deps.overlay.show({ hint: opts?.hint ?? true });
    return true;
  }

  function update(): void {
    if (!active) return;
    const phase = deps.phase();
    if (deps.modals.topId() !== PHOTO_MODE.modalId || phase === 'sequence' || phase === 'choice') exit();
  }

  function pan(dx: -1 | 0 | 1, dy: -1 | 0 | 1): void {
    if (!active) return;
    deps.camera.panBy(dx * PHOTO_MODE.panScreenPx, dy * PHOTO_MODE.panScreenPx);
  }

  function zoom(dir: 1 | -1): void {
    if (!active) return;
    deps.camera.zoomStep(dir);
  }

  return {
    enter,
    exit,
    update,
    pan,
    zoom,
    isActive: () => active,
    state: () => ({ active, hint: active && deps.overlay.hintVisible() }),
    destroy: exit,
  };
}
