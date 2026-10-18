import Phaser from 'phaser';
import { VIEW, WORLD, CAMERA, PIXEL_SCALE } from '../../data/world';
import { PALETTE_CSS } from '../../data/palette';
import type { Vec2 } from '../../data/machineComponents';
import {
  minZoomToFit,
  clampZoom,
  clampCenter,
  zoomAroundPoint,
  wheelToSnappedZoom,
  dragToCenter,
} from '../math/camera';

interface DragState {
  startCenter: Vec2;
  startX: number;
  startY: number;
  active: boolean;
}

// Drag-pan, wheel-zoom-at-pointer and animated refocus for the main camera.
// The controller owns center/zoom and only writes them to the Phaser camera; it never reads them back.
export class CameraController {
  private readonly scene: Phaser.Scene;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly minZoom: number = minZoomToFit(VIEW, WORLD);
  private center: Vec2;
  private zoom: number;
  private drag: DragState | null = null;
  private refocusTween: Phaser.Tweens.Tween | null = null;
  private lastWheelMs = Number.NEGATIVE_INFINITY; // performance.now() of the last applied wheel step

  // pointer handlers are arrow properties so `this` is bound and the same references can be removed in destroy()
  private readonly pointerdown = (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]): void => {
    if (currentlyOver.length > 0) return;
    if (!pointer.leftButtonDown() && !pointer.middleButtonDown()) return;
    this.drag = { startCenter: { ...this.center }, startX: pointer.x, startY: pointer.y, active: false };
  };

  private readonly pointermove = (pointer: Phaser.Input.Pointer): void => {
    if (this.drag === null || !pointer.isDown) return;
    const dx = pointer.x - this.drag.startX;
    const dy = pointer.y - this.drag.startY;
    if (!this.drag.active && Math.hypot(dx, dy) <= CAMERA.dragThresholdPx) return;
    this.drag.active = true;
    this.cancelRefocus();
    this.center = clampCenter(dragToCenter(this.drag.startCenter, { x: dx, y: dy }, this.zoom), this.zoom, VIEW, WORLD);
    this.apply();
  };

  private readonly pointerup = (): void => {
    this.drag = null;
  };

  private readonly pointerupoutside = (): void => {
    this.drag = null;
  };

  private readonly wheel = (
    pointer: Phaser.Input.Pointer,
    _currentlyOver: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void => {
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

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.camera.setBounds(0, 0, WORLD.width, WORLD.height);
    this.camera.setBackgroundColor(PALETTE_CSS.ink);
    this.zoom = CAMERA.defaultZoom;
    this.center = clampCenter({ x: CAMERA.focus.x, y: CAMERA.focus.y }, this.zoom, VIEW, WORLD);
    this.apply();
    scene.input.on('pointerdown', this.pointerdown);
    scene.input.on('pointermove', this.pointermove);
    scene.input.on('pointerup', this.pointerup);
    scene.input.on('pointerupoutside', this.pointerupoutside);
    scene.input.on('wheel', this.wheel);
  }

  refocus(): void {
    this.cancelRefocus();
    this.drag = null;
    const from = { center: { ...this.center }, zoom: this.zoom };
    const toZoom = CAMERA.defaultZoom;
    const toCenter = clampCenter({ x: CAMERA.focus.x, y: CAMERA.focus.y }, toZoom, VIEW, WORLD);
    this.refocusTween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: CAMERA.refocusMs,
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

  destroy(): void {
    this.cancelRefocus();
    this.scene.input.off('pointerdown', this.pointerdown);
    this.scene.input.off('pointermove', this.pointermove);
    this.scene.input.off('pointerup', this.pointerup);
    this.scene.input.off('pointerupoutside', this.pointerupoutside);
    this.scene.input.off('wheel', this.wheel);
    this.drag = null;
  }

  private apply(): void {
    this.camera.setZoom(this.zoom);
    this.camera.centerOn(this.center.x, this.center.y);
  }

  private cancelRefocus(): void {
    this.refocusTween?.stop();
    this.refocusTween = null;
  }
}
