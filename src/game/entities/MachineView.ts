import Phaser from 'phaser';
import { DEPTH, CRANK_FEEDBACK, MACHINE_ANCHOR, PIXEL_SCALE } from '../../data/world';
import { MACHINE_COMPONENTS, MACHINE_COMPONENT_IDS } from '../../data/machineComponents';
import type { MachineComponentId, Vec2 } from '../../data/machineComponents';
import { componentDepth, isComponentVisible, machineLocalToWorld, resolveAttachment } from '../math/machineLayout';
import type { GameContext } from '../context';

/** The machine container: one sprite per component, visibility driven by tech levels. */
export class MachineView {
  readonly container: Phaser.GameObjects.Container;
  private readonly ctx: GameContext;
  private readonly sprites = new Map<MachineComponentId, Phaser.GameObjects.Sprite>();
  private readonly unsubscribeReset: () => void;
  private readonly shakeOffset = { x: 0 };
  private shakeTween: Phaser.Tweens.Tween | null = null;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;
    this.container = scene.add
      .container(MACHINE_ANCHOR.x, MACHINE_ANCHOR.y)
      .setScale(PIXEL_SCALE)
      .setDepth(DEPTH.machine);

    for (const id of MACHINE_COMPONENT_IDS) {
      const def = MACHINE_COMPONENTS[id];
      const att = resolveAttachment(def);
      const sprite = scene.add
        .sprite(att.x, att.y, def.assetId)
        .setOrigin(def.origin.x, def.origin.y)
        .setDepth(componentDepth(def));
      this.sprites.set(id, sprite);
      this.container.add(sprite);
    }
    // Container renders children in list order; sort by depth so layers stack correctly.
    this.container.sort('depth');
    this.sync();

    this.unsubscribeReset = ctx.session.on('reset', () => this.sync());
  }

  /** Sets each component's visibility from the current tech levels. */
  sync(): void {
    const techLevels = this.ctx.session.state.techLevels;
    for (const id of MACHINE_COMPONENT_IDS) {
      const def = MACHINE_COMPONENTS[id];
      const sprite = this.sprites.get(id);
      sprite?.setVisible(isComponentVisible(def, techLevels));
    }
  }

  getComponentSprite(id: MachineComponentId): Phaser.GameObjects.Sprite | undefined {
    return this.sprites.get(id);
  }

  /** World px position of a component's attachment point. */
  getComponentWorldPosition(id: MachineComponentId): Vec2 {
    return machineLocalToWorld(resolveAttachment(MACHINE_COMPONENTS[id]));
  }

  /** Short horizontal jolt of the whole machine; always ends on the exact anchor. */
  shake(): void {
    if (this.shakeTween) {
      this.shakeTween.stop();
    }
    this.shakeOffset.x = 0;
    this.container.setPosition(MACHINE_ANCHOR.x, MACHINE_ANCHOR.y);
    this.shakeTween = this.scene.tweens.add({
      targets: this.shakeOffset,
      x: CRANK_FEEDBACK.shakePx * PIXEL_SCALE,
      duration: CRANK_FEEDBACK.shakeMs / 2,
      yoyo: true,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.container.setX(MACHINE_ANCHOR.x + this.shakeOffset.x),
      onComplete: () => {
        this.shakeOffset.x = 0;
        this.container.setPosition(MACHINE_ANCHOR.x, MACHINE_ANCHOR.y);
        this.shakeTween = null;
      },
    });
  }

  destroy(): void {
    this.unsubscribeReset();
    if (this.shakeTween) {
      this.shakeTween.stop();
      this.shakeTween = null;
    }
    this.container.setPosition(MACHINE_ANCHOR.x, MACHINE_ANCHOR.y);
    this.sprites.clear();
    this.container.destroy(true);
  }
}
