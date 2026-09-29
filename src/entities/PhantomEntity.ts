import Phaser from 'phaser';
import { CastHits } from '../systems/CombatRules';
import type { PhantomVariant } from '../data/enemy-recipes';
export type { PhantomVariant } from '../data/enemy-recipes';

const BASE_HP: Record<PhantomVariant, number> = { phantom: 30, rider: 45, creeper: 60, firework: 80, wither: 100, warden: 125 };
const BOSS_MULT = 16;

/** Telegraph -> fixed attack -> recovery. No player-posture gates or healing. */
export class PhantomEntity extends Phaser.Physics.Arcade.Sprite {
  readonly variant: PhantomVariant;
  readonly isBoss: boolean;
  readonly elite: boolean;
  readonly stage: number;
  maxHealth: number;
  health: number;
  contactDamage: number;
  shotDamage: number;
  phase = 1;
  flankStacks = 0;
  lockedAngle = 0;
  abilityActive = false;
  abilityElapsed = 0;
  attackStarted = false;
  recoveryMs = 0;
  private cooldownMs = 1300;
  private flashMs = 0;
  readonly castHits = new CastHits();

  constructor(scene: Phaser.Scene, x: number, y: number, variant: PhantomVariant = 'phantom', isBoss = false, elite = false, stage = 0) {
    super(scene, x, y, variant === 'phantom' ? 'phantom' : `${variant}Phantom`);
    this.variant = variant; this.isBoss = isBoss; this.elite = elite; this.stage = stage;
    const scaled = Math.round(BASE_HP[variant] * (elite ? 1.8 : 1) * (1 + stage * 0.45));
    this.maxHealth = isBoss ? scaled * BOSS_MULT : scaled;
    this.health = this.maxHealth;
    this.contactDamage = Math.round((variant === 'rider' ? 8 : 5) * (1 + stage * 0.18));
    this.shotDamage = Math.round((variant === 'warden' ? 10 : 7) * (1 + stage * 0.18));
    this.cooldownMs = 1000 + Math.random() * 1000;
    scene.add.existing(this); scene.physics.add.existing(this);
    const size = isBoss ? 82 : elite ? 64 : variant === 'phantom' ? 46 : 58;
    this.setDisplaySize(size, size * 0.66).setDepth(3);
    (this.body as Phaser.Physics.Arcade.Body).setSize(34, 24, true);
    if (isBoss) this.setTint(0xffd467);
  }

  updateAI(player: Phaser.Physics.Arcade.Sprite, delta: number): void {
    if (!this.active || this.health <= 0) return;
    this.flashMs = Math.max(0, this.flashMs - delta);
    if (!this.flashMs) { if (this.isBoss) this.setTint(0xffd467); else this.clearTint(); }
    if (this.recoveryMs > 0) {
      this.recoveryMs = Math.max(0, this.recoveryMs - delta);
      this.setVelocity(0, 0);
      return;
    }
    if (this.abilityActive) {
      this.abilityElapsed += delta;
      if (this.abilityElapsed < this.getTelegraphDuration()) this.setVelocity(0, 0);
      else if (this.variant === 'phantom' || this.variant === 'rider' || this.variant === 'firework') {
        const speed = (this.variant === 'firework' ? 320 : 260) + this.stage * 10;
        this.setVelocity(Math.cos(this.lockedAngle) * speed, Math.sin(this.lockedAngle) * speed);
      }
      if (this.abilityElapsed >= this.getTelegraphDuration() + this.getAbilityDuration()) {
        this.abilityActive = false;
        this.setVelocity(0, 0);
        this.recoveryMs = this.isBoss ? 850 : 500;
        this.cooldownMs = this.getAbilityCooldown();
      }
      return;
    }
    this.cooldownMs -= delta;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    const reach = this.variant === 'creeper' ? 140 : this.variant === 'wither' || this.variant === 'warden' ? 500 : 320;
    this.setFlipX(Math.cos(angle) < 0);
    if (this.cooldownMs <= 0 && distance <= reach) {
      this.abilityActive = true; this.abilityElapsed = 0;
      this.lockedAngle = angle; this.attackStarted = false; this.castHits.reset();
      this.setVelocity(0, 0);
      return;
    }
    const ranged = this.variant === 'wither' || this.variant === 'warden';
    const speed = ranged && distance < 220 ? -45 : 72 + this.stage * 8;
    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }
  getTelegraphDuration(): number {
    if (this.variant === 'phantom') return 550;
    return this.variant === 'rider' || this.variant === 'firework' ? 650 : this.variant === 'creeper' ? 900 : 1000;
  }
  getAbilityDuration(): number { return this.variant === 'creeper' ? 250 : 480; }
  getAbilityCooldown(): number { return this.isBoss ? (this.phase === 2 ? 1000 : 1500) : 2000; }
  get warningProgress(): number { return Math.min(1, this.abilityElapsed / this.getTelegraphDuration()); }
  damage(amount: number): boolean {
    if (!Number.isFinite(amount) || amount <= 0 || !this.active) return false;
    this.health = Math.max(0, this.health - amount);
    this.flashMs = 75;
    this.setTintFill(0xffffff);
    if (this.isBoss && this.phase === 1 && this.health <= this.maxHealth / 2) this.phase = 2;
    return this.health <= 0;
  }
  enteredPhaseTwo(beforeRatio: number): boolean { return this.isBoss && this.phase === 2 && beforeRatio > 0.5 && this.health <= this.maxHealth / 2; }
  cancelCast(pause = 1000): void {
    this.abilityActive = false; this.abilityElapsed = 0; this.attackStarted = false;
    this.recoveryMs = pause; this.cooldownMs = this.getAbilityCooldown();
    this.setVelocity(0, 0);
  }
}
