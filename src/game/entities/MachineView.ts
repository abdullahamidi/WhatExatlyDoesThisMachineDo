import Phaser from 'phaser';
import { DEPTH, CRANK_FEEDBACK, MACHINE_ANCHOR, PIXEL_SCALE } from '../../data/world';
import { MACHINE_COMPONENTS, MACHINE_COMPONENT_IDS } from '../../data/machineComponents';
import type { MachineComponentId, Vec2 } from '../../data/machineComponents';
import { componentDepth, isComponentVisible, machineLocalToWorld, resolveAttachment } from '../math/machineLayout';
import type { GameContext } from '../context';

/**
 * The machine container: one sprite per component, visibility driven by tech levels.
 * Layout lives on the outer `container`; the inner `parts` container holds the sprites and is the only thing shaken.
 */
export class MachineView {
  readonly container: Phaser.GameObjects.Container;
  private readonly parts: Phaser.GameObjects.Container;
  private readonly ctx: GameContext;
  private readonly sprites = new Map<MachineComponentId, Phaser.GameObjects.Sprite>();
  private readonly unsubscribeReset: () => void;
  private shakeTween: Phaser.Tweens.TweenChain | null = null;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;
    this.container = scene.add
      .container(MACHINE_ANCHOR.x, MACHINE_ANCHOR.y)
      .setScale(PIXEL_SCALE)
      .setDepth(DEPTH.machine);
    this.parts = scene.add.container(0, 0);
    this.container.add(this.parts);

    for (const id of MACHINE_COMPONENT_IDS) {
      const def = MACHINE_COMPONENTS[id];
      const att = resolveAttachment(def);
      const sprite = scene.add
        .sprite(att.x, att.y, def.assetId)
        .setOrigin(def.origin.x, def.origin.y)
        .setDepth(componentDepth(def));
      this.sprites.set(id, sprite);
      this.parts.add(sprite);
    }
    // Container renders children in list order; sort by depth so layers stack correctly.
    this.parts.sort('depth');
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

  /**
   * Short horizontal jolt of the machine parts: -a, then +a, then back to rest (x = 0).
   * A running shake is stopped first; the rest position is only reached by the final step.
   */
  shake(): void {
    this.shakeTween?.stop();
    const a = CRANK_FEEDBACK.shakePx; // art px; parts live inside the scaled container, so no PIXEL_SCALE here
    const quarter = CRANK_FEEDBACK.shakeMs / 4;
    this.shakeTween = this.scene.tweens.chain({
      targets: this.parts,
      tweens: [
        { x: -a, duration: quarter, ease: 'Sine.easeInOut' },
        { x: a, duration: quarter * 2, ease: 'Sine.easeInOut' },
        { x: 0, duration: quarter, ease: 'Sine.easeInOut' },
      ],
      onComplete: () => {
        this.parts.setX(0);
        this.shakeTween = null;
      },
    });
  }

  destroy(): void {
    this.unsubscribeReset();
    this.shakeTween?.stop();
    this.shakeTween = null;
    this.container.setPosition(MACHINE_ANCHOR.x, MACHINE_ANCHOR.y);
    this.sprites.clear();
    this.container.destroy(true);
  }
}
