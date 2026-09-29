import Phaser from 'phaser';

export class PlayerEntity extends Phaser.Physics.Arcade.Sprite {
  maxHealth = 100;
  health = this.maxHealth;
  private invulnerableUntil = 0;
  private slowedUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDisplaySize(52, 38).setCollideWorldBounds(true).setDepth(4);
  }

  get hurt(): boolean { return this.scene.time.now < this.slowedUntil; }

  damage(amount: number): boolean {
    if (this.scene.time.now < this.invulnerableUntil) return false;
    this.invulnerableUntil = this.scene.time.now + 420;
    this.slowedUntil = this.scene.time.now + 700;
    this.health = Math.max(0, this.health - amount);
    this.setTint(0xff8d9a);
    this.scene.time.delayedCall(700, () => { if (!this.hurt) this.clearTint(); });
    return true;
  }
}
