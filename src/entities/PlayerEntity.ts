import Phaser from 'phaser';

export class PlayerEntity extends Phaser.Physics.Arcade.Sprite {
  maxHealth = 100;
  health = 100;
  private invulnerableMs = 0;
  private flashMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDisplaySize(52, 38).setCollideWorldBounds(true).setDepth(4);
    (this.body as Phaser.Physics.Arcade.Body).setSize(24, 20, true);
  }
  /** Gameplay timers advance only during an unpaused combat update. */
  step(delta: number): void {
    this.invulnerableMs = Math.max(0, this.invulnerableMs - delta);
    this.flashMs = Math.max(0, this.flashMs - delta);
    if (!this.flashMs) this.clearTint();
  }
  get hurt(): boolean { return this.flashMs > 0; }
  protect(ms: number): void { this.invulnerableMs = Math.max(this.invulnerableMs, ms); }
  damage(amount: number): boolean {
    if (!Number.isFinite(amount) || amount <= 0 || this.invulnerableMs > 0 || this.health <= 0) return false;
    this.health = Math.max(0, this.health - amount);
    this.protect(420);
    this.flashMs = 180;
    this.setTintFill(0xffffff);
    return true;
  }
}
