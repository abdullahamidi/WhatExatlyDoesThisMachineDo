import Phaser from 'phaser';
import { VIEW, WORLD, CAMERA, PIXEL_SCALE, GROUND_Y } from '../../data/world';
import { PALETTE_CSS } from '../../data/palette';
import { REDUCED_MOTION } from '../../data/settings';
import { CAMERA_NUDGE } from '../../data/ux';
import { nudgeCenter } from '../math/nudge';
import type { Vec2 } from '../../data/machineComponents';
import type { GameSession } from '../../simulation';
import { motionPolicy } from '../../simulation/settings';
import {
  effectiveMinZoom,
  clampZoom,
  clampCenter,
  zoomAroundPoint,
  wheelToSnappedZoom,
  dragToCenter,
  viewBounds,
  boundsInView,
  fitView,
  hudTopInsetAt,
  hudSafeCenterY,
} from '../math/camera';
import { visibleMachineBounds, boundsToWorld } from '../math/machineBounds';
import type { CameraPose } from '../math/finale';
import { portraitPose, photoPanPose, photoZoomPose } from '../math/showcase';

interface DragState {
  startCenter: Vec2;
  startX: number;
  startY: number;
  active: boolean;
}

// Drag-pan, wheel-zoom-at-pointer, animated refocus and machine auto-framing for the main camera.
// The controller owns center/zoom and only writes them to the Phaser camera; it never reads them back.
export class CameraController {
  private readonly scene: Phaser.Scene;
  private readonly session: GameSession;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly minZoom: number = effectiveMinZoom(VIEW, WORLD, CAMERA.minZoom);
  private center: Vec2;
  private zoom: number;
  private drag: DragState | null = null;
  private autoFrameSkipped = false; // a purchase/unlock refocus was skipped while dragging; replayed on release
  private refocusTween: Phaser.Tweens.Tween | null = null;
  private lastWheelMs = Number.NEGATIVE_INFINITY; // performance.now() of the last applied wheel step
  /** True while the finale drives the camera (setOverride): drag, wheel and auto-frame are ignored. */
  private overridden = false;
  private uiScale: number; // last UI scale the framing used; a change refocuses once (WP22 F11)
  private readonly unsubscribes: Array<() => void> = [];

  // pointer handlers are arrow properties so `this` is bound and the same references can be removed in destroy()
  private readonly pointerdown = (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]): void => {
    if (this.overridden) return;
    if (currentlyOver.length > 0) return;
    if (!pointer.leftButtonDown() && !pointer.middleButtonDown()) return;
    this.drag = { startCenter: { ...this.center }, startX: pointer.x, startY: pointer.y, active: false };
    this.autoFrameSkipped = false;
  };

  private readonly pointermove = (pointer: Phaser.Input.Pointer): void => {
    if (this.drag === null || !pointer.isDown) return;
    const dx = pointer.x - this.drag.startX;
    const dy = pointer.y - this.drag.startY;
    if (!this.drag.active && Math.hypot(dx, dy) <= CAMERA.dragThresholdPx) return;
    if (!this.drag.active) {
      // the view may have moved since pointerdown (an in-flight refocus): drag from where it is now
      this.drag.startCenter = { ...this.center };
    }
    this.drag.active = true;
    this.cancelRefocus();
    this.center = clampCenter(dragToCenter(this.drag.startCenter, { x: dx, y: dy }, this.zoom), this.zoom, VIEW, WORLD);
    this.apply();
  };

  private readonly pointerup = (): void => {
    this.endDrag();
  };

  private readonly pointerupoutside = (): void => {
    this.endDrag();
  };

  private readonly wheel = (
    pointer: Phaser.Input.Pointer,
    _currentlyOver: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void => {
    if (this.overridden) return;
    const now = performance.now();
    if (now - this.lastWheelMs < CAMERA.wheelStepCooldownMs) return; // trackpads fire bursts; one grid step per window
    this.cancelRefocus();
    const newZoom = wheelToSnappedZoom(this.zoom, deltaY, PIXEL_SCALE, this.minZoom, CAMERA.maxZoom);
    if (newZoom === this.zoom) return;
    this.lastWheelMs = now;
    const pointerWorld: Vec2 = {
      x: this.center.x + (pointer.x - VIEW.width / 2) / this.zoom,
      y: this.center.y + (pointer.y - VIEW.height / 2) / this.zoom,
    };
    this.center = clampCenter(zoomAroundPoint(this.center, pointerWorld, this.zoom, newZoom), newZoom, VIEW, WORLD);
    this.zoom = newZoom;
    this.apply();
    if (this.drag !== null) {
      // a drag in progress continues from the new view: re-base so the next move does not jump
      this.drag.startCenter = { ...this.center };
      this.drag.startX = pointer.x;
      this.drag.startY = pointer.y;
    }
  };

  constructor(scene: Phaser.Scene, session: GameSession) {
    this.scene = scene;
    this.session = session;
    this.camera = scene.cameras.main;
    this.camera.setBounds(0, 0, WORLD.width, WORLD.height);
    this.camera.setBackgroundColor(PALETTE_CSS.ink);
    this.uiScale = session.settings.uiScale;
    const initial = this.target();
    this.zoom = initial.zoom;
    this.center = initial.center;
    this.apply();
    scene.input.on('pointerdown', this.pointerdown);
    scene.input.on('pointermove', this.pointermove);
    scene.input.on('pointerup', this.pointerup);
    scene.input.on('pointerupoutside', this.pointerupoutside);
    scene.input.on('wheel', this.wheel);
    this.unsubscribes.push(
      session.on('purchase', () => this.autoFrame()),
      session.on('unlock', () => this.autoFrame()),
      session.on('reset', () => this.refocus()),
      session.on('settings', (s) => this.uiScaleChanged(s.uiScale)),
    );
  }

  refocus(): void {
    this.cancelRefocus();
    this.drag = null;
    this.autoFrameSkipped = false; // this refocus supersedes any skipped auto-frame
    this.animateTo(this.target());
  }

  /** Current pose of the controller's own state (photo mode entry / debug). */
  pose(): CameraPose {
    return { centerX: this.center.x, centerY: this.center.y, zoom: this.zoom };
  }

  /** Photo mode / explicit move: tween to a pose (reduced motion: jump). Ignored while the finale overrides the camera. */
  moveTo(pose: CameraPose): void {
    if (this.overridden) return;
    this.drag = null;
    this.autoFrameSkipped = false;
    this.animateTo({ center: { x: pose.centerX, y: pose.centerY }, zoom: pose.zoom });
  }

  /** Photo mode keyboard pan by screen px (clamped to the world). Ignored while overridden. */
  panBy(dxScreenPx: number, dyScreenPx: number): void {
    if (this.overridden) return;
    this.cancelRefocus();
    this.setPose(photoPanPose(this.pose(), dxScreenPx, dyScreenPx));
  }

  /** One zoom grid step (0.25) in (dir 1) or out (dir -1) around the current centre. Ignored while overridden. */
  zoomStep(dir: 1 | -1): void {
    if (this.overridden) return;
    this.cancelRefocus();
    this.setPose(photoZoomPose(this.pose(), dir));
  }

  /**
   * Finale camera. A non-null pose is clamped like any view (world bounds, zoom range) and written at once; drag, wheel and
   * auto-frame are ignored while it is set. null releases the override and the camera keeps its current pose (no jump).
   */
  setOverride(pose: CameraPose | null): void {
    if (pose === null) {
      this.overridden = false;
      return;
    }
    this.overridden = true;
    this.cancelRefocus();
    this.drag = null;
    this.autoFrameSkipped = false;
    this.zoom = clampZoom(pose.zoom, this.minZoom, CAMERA.maxZoom);
    this.center = clampCenter({ x: pose.centerX, y: pose.centerY }, this.zoom, VIEW, WORLD);
    this.apply();
  }

  destroy(): void {
    this.cancelRefocus();
    this.scene.input.off('pointerdown', this.pointerdown);
    this.scene.input.off('pointermove', this.pointermove);
    this.scene.input.off('pointerup', this.pointerup);
    this.scene.input.off('pointerupoutside', this.pointerupoutside);
    this.scene.input.off('wheel', this.wheel);
    for (const unsubscribe of this.unsubscribes) {
      unsubscribe();
    }
    this.unsubscribes.length = 0;
    this.drag = null;
    this.autoFrameSkipped = false;
  }

  // Camera framing for the current machine: the default view when the machine fits it, otherwise the fitted view.
  // The finale endings (choice / postgame) frame the canonical portrait instead, so keep, reload and refocus agree (WP18).
  private target(): { center: Vec2; zoom: number } {
    const phase = this.session.state.ending.phase;
    if (phase === 'choice' || phase === 'postgame') {
      const p = portraitPose();
      return { center: { x: p.centerX, y: p.centerY }, zoom: p.zoom };
    }
    if (!CAMERA.autoFrame) {
      return {
        center: clampCenter({ x: CAMERA.focus.x, y: CAMERA.focus.y }, CAMERA.defaultZoom, VIEW, WORLD),
        zoom: CAMERA.defaultZoom,
      };
    }
    return fitView(boundsToWorld(visibleMachineBounds(this.session.state.techLevels)), VIEW, {
      margin: CAMERA.fitMarginPx,
      pixelScale: PIXEL_SCALE,
      minZoom: this.minZoom,
      maxZoom: CAMERA.maxZoom,
      defaultZoom: CAMERA.defaultZoom,
      defaultCenter: { x: CAMERA.focus.x, y: CAMERA.focus.y },
      world: WORLD,
      hudTopInsetPx: this.hudInset(),
      fullView: { groundY: GROUND_Y, groundBandPx: CAMERA.fullViewGroundBandPx, topMinPx: CAMERA.fullViewTopMinPx },
    });
  }

  // Screen px under the HUD panel at the current UI scale (WP22 F11).
  private hudInset(): number {
    return hudTopInsetAt(CAMERA.hudTopInsetPx, this.uiScale, CAMERA.hudTopInsetPadPx);
  }

  // The HUD inset follows the UI scale: refocus once when it changes. Not while the finale overrides the camera, and not
  // in the choice / postgame portrait (its pose does not depend on the inset).
  private uiScaleChanged(uiScale: number): void {
    if (uiScale === this.uiScale) return;
    this.uiScale = uiScale;
    if (this.overridden) return;
    const phase = this.session.state.ending.phase;
    if (phase === 'choice' || phase === 'postgame') return;
    this.refocus();
  }

  // Purchases and unlocks grow the machine: refocus only when the machine no longer fits the current view.
  // During an active drag the refocus is deferred to the pointer release (see endDrag).
  private autoFrame(): void {
    if (this.overridden) return;
    if (this.drag?.active === true) {
      this.autoFrameSkipped = true;
      return;
    }
    const machine = boundsToWorld(visibleMachineBounds(this.session.state.techLevels));
    if (boundsInView(machine, viewBounds(this.center, this.zoom, VIEW), CAMERA.fitMarginPx)) return;
    this.animateTo(this.target());
  }

  // Ends the drag on pointer release; an auto-frame skipped during the drag runs now.
  private endDrag(): void {
    this.drag = null;
    if (!this.autoFrameSkipped) return;
    this.autoFrameSkipped = false;
    this.autoFrame();
  }

  // Tweens center/zoom from the current view to the given one (drag state untouched).
  // Reduced motion (no camera tween): the duration is REDUCED_MOTION.cameraTweenMs and the view jumps straight to the target.
  private animateTo(to: { center: Vec2; zoom: number }): void {
    this.cancelRefocus();
    const duration = motionPolicy(this.session.settings).cameraTween ? CAMERA.refocusMs : REDUCED_MOTION.cameraTweenMs;
    if (duration <= 0) {
      this.zoom = clampZoom(to.zoom, this.minZoom, CAMERA.maxZoom);
      this.center = clampCenter(to.center, this.zoom, VIEW, WORLD);
      this.apply();
      return;
    }
    const from = { center: { ...this.center }, zoom: this.zoom };
    const toZoom = to.zoom;
    const toCenter = to.center;
    this.refocusTween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 1;
        this.zoom = clampZoom(from.zoom + (toZoom - from.zoom) * t, this.minZoom, CAMERA.maxZoom);
        this.center = clampCenter(
          {
            x: from.center.x + (toCenter.x - from.center.x) * t,
            y: from.center.y + (toCenter.y - from.center.y) * t,
          },
          this.zoom,
          VIEW,
          WORLD,
        );
        this.apply();
      },
      onComplete: () => {
        this.refocusTween = null;
      },
    });
  }

  private apply(): void {
    this.camera.setZoom(this.zoom);
    this.camera.centerOn(this.center.x, this.center.y);
  }

  // Immediate write of a pose the photo helpers already clamped (no tween).
  private setPose(p: CameraPose): void {
    this.center = { x: p.centerX, y: p.centerY };
    this.zoom = p.zoom;
    this.apply();
  }

  private cancelRefocus(): void {
    this.refocusTween?.stop();
    this.refocusTween = null;
  }

  /** WP20 D2: after the TECH INDEX closes, ease the view toward newly released parts when they sit outside the inner box. */
  nudgeToward(target: Vec2): void {
    if (this.overridden || this.refocusTween !== null || this.drag?.active === true) return;
    if (!motionPolicy(this.session.settings).cameraTween) return;
    const next = nudgeCenter(this.center, this.zoom, target, VIEW, CAMERA_NUDGE);
    if (next === null) return;
    if (this.zoom > this.minZoom + 1e-9) {
      // the nudge must not pan the machine top back under the HUD when the machine fits below it (WP22 F11).
      // At the min zoom the fullView framing ignores the inset, so the nudge does too.
      const machine = boundsToWorld(visibleMachineBounds(this.session.state.techLevels));
      next.y = hudSafeCenterY(next.y, this.center.y, machine, this.zoom,
        { height: VIEW.height, insetPx: this.hudInset(), marginPx: CAMERA.fitMarginPx });
    }
    this.animateTo({ center: clampCenter(next, this.zoom, VIEW, WORLD), zoom: this.zoom });
  }
}
