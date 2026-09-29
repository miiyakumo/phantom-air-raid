import Phaser from 'phaser';

export type PhantomVariant = 'phantom' | 'rider' | 'creeper' | 'firework' | 'wither' | 'warden';

const BASE_HP: Record<PhantomVariant, number> = { phantom: 30, rider: 45, creeper: 60, firework: 80, wither: 100, warden: 125 };
/** Bosses are a short fight, not a separate million-HP pool. About 16x a same-stage elite. */
const BOSS_MULT = 16;

export class PhantomEntity extends Phaser.Physics.Arcade.Sprite {
  readonly variant: PhantomVariant;
  readonly isBoss: boolean;
  readonly elite: boolean;
  readonly stage: number;
  maxHealth: number;
  health: number;
  contactDamage: number;
  shotDamage: number;
  lockedAngle = 0;
  abilityReady = false;
  abilityActive = false;
  abilityElapsed = 0;
  strafe = 1;
  /** Boss-only phase. 1 is the opening pattern, 2 starts at half health. */
  phase = 1;
  /** Damage taken during the current telegraph. Enough of it cancels the cast. */
  poise = 0;
  /** Elite backstab lock. While this is running the shield cannot flip. */
  exposedUntil = 0;
  flankStacks = 0;
  /** Last time a player shot landed. Elite shields stay pinned while this is fresh. */
  shotAt = 0;
  /** Lock pressure. While active this enemy abandons its orbit and hunts. */
  grudgeUntil = 0;
  herdedUntil = 0;
  shoveUntil = 0;
  severedUntil = 0;
  enragedUntil = 0;
  charge = 0;
  cover = 0;
  coverUntil = 0;
  exposedUntilStamp = 0;
  /** Freshly rebuilt cover bites back on the first hit. */
  coverSpite = false;
  private diveTimer = 0;
  private abilityTimer = 0;
  private hitFlashRemaining = 0;
  private orbit = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, variant: PhantomVariant = 'phantom', isBoss = false, elite = false, stage = 0) {
    super(scene, x, y, variant === 'phantom' ? 'phantom' : `${variant}Phantom`);
    this.variant = variant; this.isBoss = isBoss; this.elite = elite; this.stage = stage;
    const scaled = Math.round(BASE_HP[variant] * (elite ? 1.8 : 1) * (1 + stage * 0.45));
    this.maxHealth = isBoss ? scaled * BOSS_MULT : scaled;
    this.health = this.maxHealth;
    const pressure = 1 + stage * 0.18 + (isBoss ? 0.35 : elite ? 0.15 : 0);
    this.contactDamage = Math.round((variant === 'rider' ? 8 : 5) * pressure);
    this.shotDamage = Math.round((variant === 'warden' ? 10 : 7) * pressure);
    this.abilityTimer = Phaser.Math.Between(700, 1800);
    this.strafe = Math.random() < 0.5 ? -1 : 1;
    this.orbit = Math.random() * Math.PI * 2;
    scene.add.existing(this); scene.physics.add.existing(this);
    const size = isBoss ? 82 : elite ? 64 : variant === 'phantom' ? 46 : 58;
    this.setDisplaySize(size, size * 0.66).setDepth(3); if (isBoss) this.setTint(0xffd467);
  }

  updateAI(player: Phaser.Physics.Arcade.Sprite, delta: number): void {
    if (!this.active) return;
    this.diveTimer -= delta; this.orbit += delta * 0.0016;
    const coolFacing = this.flipX ? Math.PI : 0;
    const coolAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    const coolDistance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    const feeding = !this.abilityActive && Math.abs(Phaser.Math.Angle.Wrap(coolAngle - coolFacing)) <= 0.7 && coolDistance <= 170;
    this.abilityTimer -= delta * (feeding ? 1 : 0.28);
    const coolState = feeding ? 1 : 2;
    if (!this.abilityActive && this.abilityTimer > 0 && this.getData('coolFed') !== coolState) {
      this.setData('coolFed', coolState);
      this.scene.events.emit(feeding ? 'skill-fed' : 'skill-starved', this.x, this.y);
    } else if (this.abilityActive || this.abilityTimer <= 0) this.setData('coolFed', 0);
    if (this.hitFlashRemaining > 0) {
      this.hitFlashRemaining -= delta;
      if (this.hitFlashRemaining <= 0) {
        if (this.isBoss) this.setTint(0xffd467); else this.clearTint();
      }
    }
    const toPlayer = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    if (!this.abilityActive && this.abilityTimer <= 0) {
      const facing = this.flipX ? Math.PI : 0;
      const inSight = Math.abs(Phaser.Math.Angle.Wrap(toPlayer - facing)) <= 1.1;
      if (!inSight && !this.isBoss) {
        this.abilityTimer = 260;
        if (!this.getData('sightHeld')) {
          this.setData('sightHeld', 1);
          this.scene.events.emit('face-held', this.x, this.y);
        }
      } else {
        this.setData('sightHeld', 0);
        this.abilityActive = true; this.abilityReady = true; this.abilityElapsed = 0; this.lockedAngle = toPlayer; this.poise = 0; this.whiffed = false;
      }
    } else if (this.abilityActive && this.abilityElapsed <= 140) {
      const velocity = player.body?.velocity;
      const moving = !!velocity && velocity.lengthSq() > 400;
      if (!moving) this.lockedAngle = toPlayer;
    }
    if (this.abilityActive) {
      this.abilityElapsed += delta;
      if (this.abilityElapsed > this.getTelegraphDuration()) this.abilityReady = false;
      if (this.abilityElapsed > this.getTelegraphDuration() && !this.whiffed) {
        this.whiffed = true;
        const velocity = player.body?.velocity;
        const moving = !!velocity && velocity.lengthSq() > 400;
        const across = moving && Math.abs(Math.sin(Math.atan2(velocity.y, velocity.x) - this.lockedAngle)) > 0.72;
        const lane = Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y) - this.lockedAngle));
        if (across && lane > 0.4) this.exposedUntil = Math.max(this.exposedUntil, this.scene.time.now + 700);
      }
      if (this.abilityElapsed > this.getTelegraphDuration() + this.getAbilityDuration()) {
        this.abilityActive = false; this.abilityTimer = this.getAbilityCooldown();
        const orbitSide = Math.sin(Phaser.Math.Angle.Wrap(toPlayer - (this.lockedAngle + this.strafe * Math.PI / 2)));
        if (orbitSide < -0.35) {
          this.strafe *= -1;
          this.scene.events.emit('orbit-flipped', this.x, this.y);
        } else this.scene.events.emit('orbit-held', this.x, this.y);
      }
    }

    const telegraph = this.abilityActive && this.abilityElapsed <= this.getTelegraphDuration();
    const striking = this.abilityActive && !telegraph;
    let angle = toPlayer;
    let speed = 70 + this.stage * 6;

    if (this.variant === 'phantom') {
      const velocity = player.body?.velocity;
      const moving = !!velocity && velocity.lengthSq() > 400;
      const across = moving && Math.abs(Math.sin(Math.atan2(velocity.y, velocity.x) - toPlayer)) > 0.72;
      if (!telegraph && !striking && across && distance < 220 && this.diveTimer <= 0) {
        this.abilityActive = true; this.abilityReady = true; this.abilityElapsed = this.getTelegraphDuration();
        this.lockedAngle = toPlayer; this.whiffed = false; this.diveTimer = 1600;
        this.scene.events.emit('orbit-flipped', this.x, this.y);
      } else if (!telegraph && !striking && this.diveTimer <= 0) this.diveTimer = 700;
      speed = telegraph ? 28 : striking ? 210 + this.stage * 6 : 54;
      angle = telegraph || striking ? this.lockedAngle : toPlayer + this.strafe * 1.1;
    } else if (this.variant === 'rider') {
      speed = striking ? 250 : distance > 180 ? 90 : 40;
      angle = striking || telegraph ? this.lockedAngle : toPlayer + this.strafe * 0.9;
    } else if (this.variant === 'creeper') {
      const wanted = striking ? 30 : 120;
      speed = distance > wanted ? 78 : 28;
      angle = distance < wanted - 20 ? toPlayer + Math.PI : toPlayer;
      if (telegraph) speed = 8;
    } else if (this.variant === 'firework') {
      speed = striking ? 230 : 64;
      angle = striking ? this.lockedAngle : toPlayer + Math.sin(this.orbit) * 1.2;
    } else if (this.variant === 'wither') {
      const orbit = 210;
      speed = Math.abs(distance - orbit) > 30 ? 88 : 46;
      angle = distance < orbit ? toPlayer + Math.PI * 0.72 * this.strafe : toPlayer + this.strafe * 0.55;
      if (striking) { angle = this.lockedAngle; speed = 20; }
    } else {
      // Warden holds a lane, then fires a beam the player has to leave.
      speed = striking ? 18 : 62;
      angle = telegraph ? this.lockedAngle : toPlayer + this.strafe * 0.35;
    }

    if (this.scene.time.now < this.enragedUntil) {
      const velocity = player.body?.velocity;
      const moving = !!velocity && velocity.lengthSq() > 400;
      const toPlayer = new Phaser.Math.Vector2(player.x - this.x, player.y - this.y);
      const tang = new Phaser.Math.Vector2(-toPlayer.y, toPlayer.x).normalize();
      const circling = moving && distance <= 120 && Math.abs(velocity.dot(tang)) > velocity.length() * 0.55;
      if (circling) this.enragedUntil -= delta * 1.5;
      if (circling && this.getData('rageCalm') !== 1) { this.setData('rageCalm', 1); this.scene.events.emit('rage-calmed', this.x, this.y); }
      else if (!circling && this.getData('rageCalm') !== 2) { this.setData('rageCalm', 2); this.scene.events.emit('rage-fueled', this.x, this.y); }
      const leashed = distance <= 92;
      speed *= leashed ? 0.72 : 1.28;
      if (leashed && !this.getData('rageLeashed')) {
        this.setData('rageLeashed', 1);
        this.scene.events.emit('rage-leashed', this.x, this.y);
      } else if (!leashed && this.getData('rageLeashed')) {
        this.setData('rageLeashed', 0);
        this.scene.events.emit('rage-loose', this.x, this.y);
      }
    } else if (this.getData('rageLeashed')) this.setData('rageLeashed', 0);
    if (this.isBoss && this.phase >= 2) {
      speed *= 1.18;
      if (!striking) angle += this.strafe * 0.45;
    } else if (this.isBoss) speed *= 0.92;
    if (this.scene.time.now < this.grudgeUntil && !telegraph && !striking) {
      angle = toPlayer;
      speed = Math.max(speed * 1.35, 148 + this.stage * 8);
    } else if (this.scene.time.now < this.herdedUntil && !telegraph && !striking) {
      angle = toPlayer;
      speed = Math.max(speed, this.isBoss ? 96 : 150);
    }
    if (!telegraph && !striking && this.scene.time.now >= this.grudgeUntil && this.scene.time.now >= this.herdedUntil) {
      const facing = this.flipX ? Math.PI : 0;
      const inFront = Math.abs(Phaser.Math.Angle.Wrap(toPlayer - facing)) <= 0.85;
      if (!inFront) {
        angle = facing;
        if (!this.getData('chaseLost')) {
          this.setData('chaseLost', 1);
          this.scene.events.emit('chase-lost', this.x, this.y);
        }
      } else if (this.getData('chaseLost')) {
        this.setData('chaseLost', 0);
        this.scene.events.emit('chase-caught', this.x, this.y);
      }
    }
    const exposedFacing = this.flipX ? Math.PI : 0;
    const exposedFront = Math.abs(Phaser.Math.Angle.Wrap(toPlayer - exposedFacing)) <= 0.75 && distance <= 130;
    if (this.exposedUntil > this.scene.time.now) this.exposedUntil += delta * (exposedFront ? 1 : -1.1);
    const exposed = this.scene.time.now < this.exposedUntil;
    const exposedBehind = exposed && Math.abs(Phaser.Math.Angle.Wrap(toPlayer - exposedFacing - Math.PI)) <= 1.05;
    if (exposed && exposedFront && this.getData('exposeFront') !== 1) { this.setData('exposeFront', 1); this.scene.events.emit('expose-front', this.x, this.y); }
    else if (exposed && !exposedFront && this.getData('exposeFront') !== 2) { this.setData('exposeFront', 2); this.scene.events.emit('expose-front-lost', this.x, this.y); }
    else if (!exposed) this.setData('exposeFront', 0);
    if (exposed) {
      speed *= exposedBehind ? 0.45 : 1.35;
      if (exposedBehind && !this.getData('exposeHeld')) {
        this.setData('exposeHeld', 1);
        this.scene.events.emit('expose-held', this.x, this.y);
      } else if (!exposedBehind && this.getData('exposeHeld')) {
        this.setData('exposeHeld', 0);
        this.scene.events.emit('expose-burst', this.x, this.y);
      }
    } else if (this.getData('exposeHeld')) this.setData('exposeHeld', 0);
    if (this.scene.time.now >= this.shoveUntil) this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    const recovering = this.whiffed && this.scene.time.now < this.exposedUntil;
    const pinned = this.elite && !this.isBoss && this.scene.time.now - this.shotAt < 650;
    if (recovering) this.setFlipX(Math.cos(this.lockedAngle) < 0);
    else if (pinned && !this.abilityActive) {
      const facing = this.flipX ? Math.PI : 0;
      const behind = Math.abs(Phaser.Math.Angle.Wrap(toPlayer - facing - Math.PI)) > 1.2;
      if (behind) {
        this.setFlipX(Math.cos(toPlayer) < 0);
        if (!this.getData('shieldTurned')) {
          this.setData('shieldTurned', 1);
          this.scene.events.emit('shield-turned', this.x, this.y);
        }
      } else if (this.getData('shieldTurned')) {
        this.setData('shieldTurned', 0);
        this.scene.events.emit('shield-held', this.x, this.y);
      }
    }
    else if (!exposed && !this.abilityActive && !this.elite) {
      const facing = this.flipX ? Math.PI : 0;
      const behind = Math.abs(Phaser.Math.Angle.Wrap(toPlayer - facing - Math.PI)) > 1.15;
      if (behind) {
        this.setFlipX(Math.cos(toPlayer) < 0);
        if (!this.getData('faceTurned')) {
          this.setData('faceTurned', 1);
          this.scene.events.emit('face-turned', this.x, this.y);
        }
      } else if (this.getData('faceTurned')) {
        this.setData('faceTurned', 0);
        this.scene.events.emit('face-held', this.x, this.y);
      }
    }
    else if (this.abilityActive) this.setFlipX(Math.cos(this.lockedAngle) < 0);
    if (this.diveTimer <= 0) this.diveTimer = this.variant === 'phantom' ? 1100 : 1600;
  }

  getTelegraphDuration(): number {
    if (this.variant === 'phantom') return 460;
    return this.variant === 'rider' || this.variant === 'firework' ? 520 : this.variant === 'creeper' ? 780 : 900;
  }
  getAbilityDuration(): number { return this.variant === 'creeper' || this.variant === 'wither' ? 700 : 480; }
  getAbilityCooldown(): number {
    const boss = this.isBoss ? (this.phase >= 2 ? 900 : 1400) : 2100;
    return Math.max(680, boss - this.stage * 80);
  }
  get warningProgress(): number { return Math.min(1, this.abilityElapsed / this.getTelegraphDuration()); }
  get grudging(): boolean { return this.scene.time.now < this.grudgeUntil; }
  enrage(duration: number): void {
    this.enragedUntil = this.scene.time.now + duration;
    this.cancelCast(duration);
  }
  feed(amount: number): void {
    if (this.abilityActive) return;
    this.abilityTimer = Math.max(0, this.abilityTimer - amount);
  }
  absorb(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }
  damage(amount: number): boolean {
    const before = this.health / this.maxHealth;
    this.health = Math.max(0, this.health - amount);
    this.shotAt = this.scene.time.now;
    this.hitFlashRemaining = 75;
    this.setTintFill(0xffffff);
    if (this.isBoss && this.phase === 1 && before > 0.5 && this.health / this.maxHealth <= 0.5) {
      this.phase = 1;
      this.phaseGate = this.scene.time.now + 1200;
    }
    if (this.isBoss && this.abilityActive && this.abilityElapsed <= this.getTelegraphDuration()) this.poise += amount;
    return this.health <= 0;
  }

  /** Hook and heavy hits can cancel a boss cast without meeting the damage guard. */
  cancelCast(pause = 1100): void {
    this.abilityActive = false;
    this.abilityReady = false;
    this.abilityElapsed = 0;
    this.poise = 0;
    this.abilityTimer = pause;
  }

  /** Close-range pressure during the warning can break the cast. */
  reading = 0;
  /** Boss waits here before phase 2. Leaving lets it recover. */
  phaseGate = 0;
  /** The current cast has passed its warning. Killing after this pays more. */
  whiffed = false;

  /** Boss telegraphs break when the player stays in their face, not by shooting the bar. */
  stagger(): boolean {
    if (!this.isBoss || !this.abilityActive || this.abilityElapsed > this.getTelegraphDuration() || this.reading < 280) return false;
    this.cancelCast(1100);
    this.reading = 0;
    return true;
  }

  /** True only on the hit that crosses into phase 2. */
  enteredPhaseTwo(beforeRatio: number): boolean {
    return this.isBoss && this.phase === 2 && beforeRatio > 0.5 && this.health / this.maxHealth <= 0.5;
  }
}
