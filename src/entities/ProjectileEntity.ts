import Phaser from 'phaser';

export class ProjectileEntity extends Phaser.Physics.Arcade.Image {
  constructor(scene: Phaser.Scene, x: number, y: number, angle: number) {
    super(scene, x, y, 'trident');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDisplaySize(24, 9).setRotation(angle).setDepth(3);
    (this.body as Phaser.Physics.Arcade.Body).setSize(20, 10, true);
  }
  /** Arcade Group insertion resets velocity; always launch after insertion. */
  launch(angle: number, speed = 420): void {
    (this.body as Phaser.Physics.Arcade.Body).enable = true;
    this.setActive(true).setVisible(true).setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed).setRotation(angle);
  }
  steerTo(target: Phaser.Physics.Arcade.Sprite, delta: number): void {
    if (!target.active || !this.body) return;
    const desired = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    const current = Math.atan2(this.body.velocity.y, this.body.velocity.x);
    const next = current + Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(desired - current), -delta * 0.0009, delta * 0.0009);
    this.setVelocity(Math.cos(next) * 420, Math.sin(next) * 420).setRotation(next);
  }
}
