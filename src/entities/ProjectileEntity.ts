import Phaser from 'phaser';

export class ProjectileEntity extends Phaser.Physics.Arcade.Image {
  constructor(scene: Phaser.Scene, x: number, y: number, angle: number) {
    super(scene, x, y, 'trident');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDisplaySize(24, 9).setRotation(angle).setDepth(3).setActive(true).setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(24, 9);
    this.setVelocity(Math.cos(angle) * 390, Math.sin(angle) * 390);
  }

  // Called after the projectile has been inserted in its physics group. This
  // makes the launch deterministic even on Phaser versions that refresh a
  // body's velocity while a group is adding it.
  launch(angle: number, speed = 420): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    this.setActive(true).setVisible(true);
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed).setRotation(angle);
  }

  /** Keeps long-range throws on the moving target without making point-blank
   * volleys unavoidable: steering is deliberately gentle and capped. */
  steerTo(target: Phaser.Physics.Arcade.Sprite, delta: number, pilot?: Phaser.Physics.Arcade.Sprite): void {
    if (!target.active || !pilot?.active) return;
    if (pilot.active) {
      const flight = new Phaser.Math.Vector2(this.body!.velocity.x, this.body!.velocity.y);
      const span = flight.length();
      if (span < 1) return;
      const toPilot = new Phaser.Math.Vector2(pilot.x - this.x, pilot.y - this.y);
      const along = toPilot.dot(flight) / span;
      const offLane = toPilot.clone().subtract(flight.clone().scale(along / span)).length();
      if (!(along > 18 && along < 150 && offLane <= 30)) return;
    }
    const desired = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    const current = Math.atan2(this.body!.velocity.y, this.body!.velocity.x);
    const turn = Phaser.Math.Angle.Wrap(desired - current);
    const guide = Number(this.getData('guide') ?? 1);
    const next = current + Phaser.Math.Clamp(turn, -0.16 * guide * delta / 16.67, 0.16 * guide * delta / 16.67);
    const speed = Math.max(360, Math.min(460, this.body!.velocity.length() || 420));
    this.setVelocity(Math.cos(next) * speed, Math.sin(next) * speed).setRotation(next);
  }
}
