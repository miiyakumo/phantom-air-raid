import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../data/game-config';
import { CHAPTERS, ENEMY_NAMES } from '../data/enemy-recipes';
import { PhantomEntity, type PhantomVariant } from '../entities/PhantomEntity';
import { PlayerEntity } from '../entities/PlayerEntity';
import { ProjectileEntity } from '../entities/ProjectileEntity';
import { EncounterSystem, type WaveKind } from '../systems/EncounterSystem';
import { EconomySystem, type EnchantId, type ShopId } from '../systems/EconomySystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { drawPixelArena } from '../systems/Visuals';
import { COMBAT, pointSegmentDistance, volleyPattern } from '../systems/CombatRules';

type Loot = { xp: number; gems: number; heal: number };
type PickupKind = 'loot' | 'core';

/** One loop: evade -> punish recovery -> collect -> choose -> next encounter. */
export class BattleScene extends Phaser.Scene {
  private player!: PlayerEntity;
  private enemies!: Phaser.Physics.Arcade.Group;
  private shots!: Phaser.Physics.Arcade.Group;
  private enemyShots!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private progression = new ProgressionSystem();
  private economy = new EconomySystem();
  private encounter = new EncounterSystem();
  private save = new SaveSystem();
  private elapsed = 0;
  private kills = 0;
  private volleyId = 0;
  private fireClock = 0;
  private spawnClock = 0;
  private skillClock = 0;
  private buffMs = 0;
  private combo = 0;
  private comboMs = 0;
  private intermissionMs = 0;
  private pendingChapterClear = false;
  private pendingUpgradePrompt = false;
  private boss?: PhantomEntity;
  private locked?: PhantomEntity;
  private paused = false;
  private finished = false;
  // Stable fields for existing replay consumers. The first revision removes heat/stall gates.
  private heat = 0;
  private overheated = false;
  private stall = 0;
  private touchTarget?: Phaser.Math.Vector2;
  private heading = new Phaser.Math.Vector2(0, -1);
  private warning!: Phaser.GameObjects.Graphics;
  private hpBar!: Phaser.GameObjects.Rectangle;
  private xpBar!: Phaser.GameObjects.Rectangle;
  private levelText!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private skillText!: Phaser.GameObjects.Text;
  private bossName!: Phaser.GameObjects.Text;
  private bossBar!: Phaser.GameObjects.Rectangle;
  private overlay?: Phaser.GameObjects.Container;

  constructor() { super('Battle'); }

  create(): void {
    this.progression = new ProgressionSystem(); this.economy.reset(); this.encounter.reset();
    this.elapsed = this.kills = this.volleyId = this.fireClock = this.skillClock = 0;
    this.buffMs = this.combo = this.comboMs = this.intermissionMs = 0;
    this.spawnClock = 1200;
    this.pendingChapterClear = this.pendingUpgradePrompt = this.paused = this.finished = false;
    this.boss = this.locked = undefined; this.touchTarget = undefined; this.overlay = undefined;
    this.heading.set(0, -1);
    this.physics.resume(); this.time.paused = false; this.tweens.resumeAll();
    this.physics.world.setBounds(18, 88, GAME_WIDTH - 36, GAME_HEIGHT - 142);
    drawPixelArena(this);
    this.player = new PlayerEntity(this, GAME_WIDTH / 2, GAME_HEIGHT - 100);
    this.enemies = this.physics.add.group({ maxSize: COMBAT.maxEnemies });
    this.shots = this.physics.add.group({ maxSize: COMBAT.maxPlayerShots });
    this.enemyShots = this.physics.add.group({ maxSize: COMBAT.maxEnemyShots });
    this.pickups = this.physics.add.group({ maxSize: 80 });
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,P,E,Q,F,G,SPACE,ESC') as unknown as Record<string, Phaser.Input.Keyboard.Key>;
    this.physics.add.overlap(this.shots, this.enemies, (shot, enemy) => this.onShotHit(shot as ProjectileEntity, enemy as PhantomEntity));
    this.physics.add.overlap(this.player, this.enemies, (_player, enemy) => {
      if (!this.paused && !this.finished) this.hurtPlayer((enemy as PhantomEntity).contactDamage);
    });
    this.physics.add.overlap(this.player, this.enemyShots, (_player, shot) => {
      if (this.paused || this.finished) return;
      const bolt = shot as Phaser.Physics.Arcade.Image;
      this.hurtPlayer(Number(bolt.getData('damage') ?? 8)); bolt.destroy();
    });
    this.warning = this.add.graphics().setDepth(2);
    this.createHud();
    this.spawnEnemy(200, 120, 'phantom'); this.spawnEnemy(480, 100, 'phantom'); this.spawnEnemy(760, 120, 'phantom');
    const down = (pointer: Phaser.Input.Pointer) => {
      if (this.paused || this.finished || pointer.y < 88 || pointer.y > 480) return;
      const target = this.activeEnemies().find(enemy => Phaser.Math.Distance.Between(pointer.x, pointer.y, enemy.x, enemy.y) < 38);
      if (target) this.locked = this.locked === target ? undefined : target;
      if (pointer.wasTouch) this.touchTarget = new Phaser.Math.Vector2(pointer.x, pointer.y);
    };
    const drag = (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown && !this.paused && !this.finished && pointer.y < 480) this.touchTarget = new Phaser.Math.Vector2(pointer.x, pointer.y);
    };
    const release = () => { this.touchTarget = undefined; };
    this.input.on('pointerdown', down); this.input.on('pointermove', drag); this.input.on('pointerup', release); this.input.on('pointerupoutside', release);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerdown', down); this.input.off('pointermove', drag); this.input.off('pointerup', release); this.input.off('pointerupoutside', release);
      this.time.paused = false; this.tweens.resumeAll();
    });
  }

  update(_time: number, delta: number): void {
    if (this.finished) return;
    if (Phaser.Input.Keyboard.JustDown(this.keys.P) && (!this.paused || this.overlay?.getData('pause'))) this.togglePause();
    if (this.paused) return;
    // Keep gameplay timers on one explicitly advanced clock; menus cannot expire casts or invulnerability.
    delta = Math.max(0, Math.min(100, delta));
    if (this.player.health <= 0) { this.end(false); return; }
    if (this.pendingChapterClear) this.completeChapter();
    if (this.finished) return;
    if (this.pendingUpgradePrompt) { this.pendingUpgradePrompt = false; this.showUpgrade(); return; }
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) { this.economy.pendingUpgrades ? this.showUpgrade() : this.showShop(); return; }
    this.player.step(delta); this.movePlayer();
    this.skillClock = Math.max(0, this.skillClock - delta);
    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.cycleLock();
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.useSkill();
    if (Phaser.Input.Keyboard.JustDown(this.keys.F)) this.useHook();
    if (Phaser.Input.Keyboard.JustDown(this.keys.G)) this.eatApple();
    this.warning.clear();
    this.pullPickups();
    if (this.intermissionMs > 0) {
      this.intermissionMs = Math.max(0, this.intermissionMs - delta);
      if (!this.intermissionMs) {
        this.spawnClock = 1200;
        const previous = CHAPTERS[Math.max(0, this.encounter.chapterIndex - 1)].boss;
        this.spawnAtEdge(previous);
        this.floatText(GAME_WIDTH / 2, 160, '曾经的首领，已加入普通怪群', '#ffe28a');
      }
      this.updateHud(); return;
    }
    this.elapsed += delta;
    this.buffMs = Math.max(0, this.buffMs - delta);
    this.comboMs = Math.max(0, this.comboMs - delta);
    if (!this.comboMs) this.combo = 0;
    this.encounter.addTime(delta); // Same rate at the center and the edge.
    this.fireClock -= delta;
    if (this.fireClock <= 0 && this.fire()) this.fireClock = this.progression.state.fireInterval;
    this.spawnClock -= delta;
    if (!this.boss && this.encounter.shouldSpawnBoss()) this.spawnBoss(this.encounter.bossVariant()!);
    if (this.spawnClock <= 0) {
      const wave = this.encounter.takeWave();
      if (wave) this.spawnWave(wave.kind, wave.label);
      else if (this.enemies.countActive() < (this.boss ? 8 : 24)) this.spawnAtEdge();
      this.spawnClock = Math.max(650, COMBAT.spawnInterval - this.encounter.stage * 80);
    }
    for (const enemy of this.activeEnemies()) {
      enemy.updateAI(this.player, delta);
      if (enemy.isBoss) enemy.setPosition(Phaser.Math.Clamp(enemy.x, 60, GAME_WIDTH - 60), Phaser.Math.Clamp(enemy.y, 115, 440));
      this.drawWarning(enemy); this.resolveAbility(enemy);
    }
    this.updateProjectiles(delta);
    if (this.locked?.active) this.warning.lineStyle(2, 0xffe28a, 0.9).strokeCircle(this.locked.x, this.locked.y, this.locked.displayWidth * 0.55);
    this.updateHud();
    if (this.player.health <= 0) this.end(false);
  }

  private activeEnemies(): PhantomEntity[] { return (this.enemies.getChildren() as PhantomEntity[]).filter(enemy => enemy.active && enemy.health > 0); }
  private movePlayer(): void {
    const v = this.touchTarget ? this.touchTarget.clone().subtract(new Phaser.Math.Vector2(this.player.x, this.player.y)) : new Phaser.Math.Vector2(
      Number(this.cursors.right.isDown || this.keys.D.isDown) - Number(this.cursors.left.isDown || this.keys.A.isDown),
      Number(this.cursors.down.isDown || this.keys.S.isDown) - Number(this.cursors.up.isDown || this.keys.W.isDown));
    if (v.lengthSq() < (this.touchTarget ? 36 : 0.1)) { this.player.setVelocity(0, 0); return; }
    v.normalize(); this.heading.copy(v);
    this.player.setVelocity(v.x * this.progression.state.speed, v.y * this.progression.state.speed);
  }
  private visibleEnemies(): PhantomEntity[] {
    return this.activeEnemies().filter(enemy => enemy.x >= 0 && enemy.x <= GAME_WIDTH && enemy.y >= 88 && enemy.y <= 480)
      .sort((a, b) => Phaser.Math.Distance.Between(this.player.x, this.player.y, a.x, a.y) - Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y));
  }
  private aimTarget(): PhantomEntity | undefined {
    if (this.locked?.active && this.locked.health > 0 && this.locked.x >= 0 && this.locked.x <= GAME_WIDTH && this.locked.y >= 88 && this.locked.y <= 480) return this.locked;
    this.locked = undefined;
    return this.visibleEnemies()[0];
  }
  private cycleLock(): void {
    if (this.paused || this.finished) return;
    const list = this.visibleEnemies();
    if (!list.length) { this.locked = undefined; return; }
    this.locked = list[(list.indexOf(this.locked!) + 1) % list.length];
  }
  private fire(): boolean {
    const target = this.aimTarget();
    if (!target || this.shots.isFull()) return false;
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);
    const lead = Math.min(0.25, distance / 420);
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x + (target.body?.velocity.x ?? 0) * lead, target.y + (target.body?.velocity.y ?? 0) * lead);
    const state = this.progression.state;
    const close = distance <= state.closeRange ? 1 + state.closeDamage : 1;
    for (const lane of volleyPattern(state.projectileCount, this.volleyId++)) {
      if (this.shots.isFull()) break;
      const shot = new ProjectileEntity(this, this.player.x, this.player.y, angle + lane.offset);
      shot.setData({ damage: state.attack * lane.multiplier * close * (1 + this.combo * 0.04) * (this.buffMs ? 1.3 : 1),
        pierce: state.pierce, hit: new Set<PhantomEntity>(), target: lane.offset === 0 ? target : undefined, born: this.elapsed });
      this.shots.add(shot); shot.launch(angle + lane.offset);
    }
    return true;
  }
  private onShotHit(shot: ProjectileEntity, enemy: PhantomEntity): void {
    if (this.paused || this.finished || !shot.active || !enemy.active) return;
    const hit = (shot.getData('hit') as Set<PhantomEntity> | undefined) ?? new Set<PhantomEntity>();
    if (hit.has(enemy)) return;
    hit.add(enemy); shot.setData('hit', hit);
    let damage = Number(shot.getData('damage') ?? this.progression.state.attack);
    if (enemy.elite && enemy.recoveryMs <= 0) {
      const incoming = Math.atan2(shot.body?.velocity.y ?? 0, shot.body?.velocity.x ?? 1);
      const facing = enemy.flipX ? Math.PI : 0;
      const front = Math.abs(Phaser.Math.Angle.Wrap(incoming - facing - Math.PI)) < 0.9;
      if (front) damage *= 0.4;
      else { damage *= 1.5; enemy.flankStacks += 1; }
    }
    this.hitEnemy(enemy, damage);
    const pierce = Number(shot.getData('pierce') ?? 0);
    if (pierce <= 0) shot.destroy();
    else { shot.setData('pierce', pierce - 1); shot.setData('target', undefined); }
  }
  private hitEnemy(enemy: PhantomEntity, damage: number): void {
    if (!enemy.active || enemy.health <= 0) return;
    const before = enemy.health / enemy.maxHealth;
    damage *= enemy.recoveryMs > 0 ? 1.25 : 1;
    const killed = enemy.damage(damage);
    this.floatText(enemy.x, enemy.y - 15, String(Math.ceil(damage)), '#e4ffff', 400);
    if (enemy.enteredPhaseTwo(before) && !killed) this.floatText(enemy.x, enemy.y - 45, '第二阶段', '#ffd467');
    if (!killed) return;
    const x = enemy.x, y = enemy.y, wasBoss = enemy.isBoss, wasElite = enemy.elite;
    const reward = this.economy.preview(wasBoss ? 'boss' : wasElite ? 'elite' : 'normal');
    enemy.destroy();
    if (this.locked === enemy) this.locked = undefined;
    this.kills += 1; this.combo = Math.min(8, this.combo + 1); this.comboMs = 4000;
    this.encounter.onKill(wasBoss);
    this.dropPickup(x, y, 'loot', reward);
    if (wasElite || wasBoss) this.dropPickup(x + 18, y, 'core');
    if (wasBoss) {
      this.boss = undefined;
      this.encounter.onBossDefeated();
      this.pendingChapterClear = true; // Defer group clearing until collision iteration has finished.
    }
  }
  private spawnEnemy(x: number, y: number, variant: PhantomVariant, boss = false, elite = false): PhantomEntity {
    const enemy = new PhantomEntity(this, x, y, variant, boss, elite, this.encounter.stage);
    this.enemies.add(enemy);
    return enemy;
  }
  private spawnBoss(variant: PhantomVariant): void {
    // Reserve a slot; ordinary spawns never fill the hard group limit.
    const spots = [[480, 125], [160, 180], [800, 180], [160, 410], [800, 410]];
    const [x, y] = spots.sort((a, b) => Math.hypot(b[0] - this.player.x, b[1] - this.player.y) - Math.hypot(a[0] - this.player.x, a[1] - this.player.y))[0];
    this.boss = this.spawnEnemy(x, y, variant, true);
    this.encounter.onBossSpawned();
    this.floatText(GAME_WIDTH / 2, 195, ENEMY_NAMES[variant], '#ffe28a', 1300);
  }
  private spawnAtEdge(variant?: PhantomVariant): void {
    if (this.enemies.countActive() >= COMBAT.maxEnemies - 1) return;
    const pick = this.encounter.nextSpawn();
    let x = 40, y = 120;
    for (let tries = 0; tries < 12; tries += 1) {
      const edge = Math.floor(Math.random() * 4);
      x = edge < 2 ? (edge === 0 ? 12 : GAME_WIDTH - 12) : 40 + Math.random() * (GAME_WIDTH - 80);
      y = edge < 2 ? 110 + Math.random() * 330 : edge === 2 ? 92 : 474;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) >= 180) break;
    }
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) < 180) return;
    this.spawnEnemy(x, y, variant ?? pick.variant, false, !variant && pick.elite);
  }
  private spawnWave(kind: WaveKind, label: string): void {
    this.floatText(GAME_WIDTH / 2, 105, label, '#cabaff');
    const type: PhantomVariant = kind === 'creeper-ring' ? 'creeper' : kind === 'wither-line' ? 'wither' : kind === 'warden-cross' ? 'warden' : 'phantom';
    const points: [number, number][] = kind === 'pincer' ? [[24, 150], [24, 350], [936, 150], [936, 350]]
      : kind === 'dive-lane' || kind === 'wither-line' ? [[240, 100], [480, 100], [720, 100]]
      : kind === 'warden-cross' ? [[60, 200], [900, 360]]
      : [0, 1, 2].map(i => [this.player.x + Math.cos(i * Math.PI * 2 / 3) * 220, this.player.y + Math.sin(i * Math.PI * 2 / 3) * 220] as [number, number]);
    for (const [px, py] of points) {
      if (this.enemies.countActive() >= COMBAT.maxEnemies - 1) break;
      const x = Phaser.Math.Clamp(px, 24, 936), y = Phaser.Math.Clamp(py, 100, 470);
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) < 170) continue;
      this.spawnEnemy(x, y, type);
    }
  }
  private resolveAbility(enemy: PhantomEntity): void {
    if (!enemy.abilityActive || enemy.abilityElapsed < enemy.getTelegraphDuration()) return;
    if (!enemy.attackStarted) {
      enemy.attackStarted = true;
      if (enemy.variant === 'wither' || enemy.variant === 'firework') {
        const offsets = enemy.variant === 'wither' && enemy.phase === 2 ? [-0.4, -0.2, 0, 0.2, 0.4] : [-0.22, 0, 0.22];
        for (const offset of offsets) this.enemyShot(enemy, enemy.lockedAngle + offset);
      }
    }
    const radius = enemy.isBoss && enemy.phase === 2 ? 150 : 118;
    const beamX = enemy.x + Math.cos(enemy.lockedAngle) * 520, beamY = enemy.y + Math.sin(enemy.lockedAngle) * 520;
    const inArea = (x: number, y: number) => enemy.variant === 'creeper'
      ? Phaser.Math.Distance.Between(enemy.x, enemy.y, x, y) <= radius
      : pointSegmentDistance(x, y, enemy.x, enemy.y, beamX, beamY) <= 18;
    if (enemy.variant !== 'creeper' && enemy.variant !== 'warden') return;
    // Discrete, once-per-cast hits. Never feed a per-frame DPS fraction into hit invulnerability.
    if (!enemy.castHits.has(this.player) && inArea(this.player.x, this.player.y)) {
      if (this.hurtPlayer((enemy.variant === 'creeper' ? 16 : 20) + enemy.stage * 3)) enemy.castHits.mark(this.player);
    }
    for (const other of this.activeEnemies()) {
      if (other === enemy || enemy.castHits.has(other) || !inArea(other.x, other.y)) continue;
      enemy.castHits.mark(other);
      this.hitEnemy(other, this.progression.state.attack * 1.8);
    }
  }
  private enemyShot(enemy: PhantomEntity, angle: number): void {
    if (this.enemyShots.isFull()) return;
    const shot = this.physics.add.image(enemy.x, enemy.y, 'enemyBolt').setDisplaySize(12, 12).setDepth(3);
    shot.setData({ damage: enemy.shotDamage, born: this.elapsed });
    this.enemyShots.add(shot);
    const speed = enemy.variant === 'firework' ? 210 : 170;
    shot.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }
  private drawWarning(enemy: PhantomEntity): void {
    if (!enemy.abilityActive) return;
    const active = enemy.abilityElapsed >= enemy.getTelegraphDuration();
    const color = active ? 0xff6d65 : 0xffd67b;
    this.warning.lineStyle(active ? 4 : 2, color, active ? 0.9 : 0.7);
    if (enemy.variant === 'creeper') {
      const radius = enemy.isBoss && enemy.phase === 2 ? 150 : 118;
      this.warning.strokeCircle(enemy.x, enemy.y, radius);
      this.warning.fillStyle(color, active ? 0.16 : 0.04).fillCircle(enemy.x, enemy.y, radius);
    } else {
      const length = enemy.variant === 'warden' ? 520 : enemy.variant === 'wither' ? 300 : 160;
      const nx = -Math.sin(enemy.lockedAngle), ny = Math.cos(enemy.lockedAngle);
      const ex = enemy.x + Math.cos(enemy.lockedAngle) * length, ey = enemy.y + Math.sin(enemy.lockedAngle) * length;
      if (enemy.variant === 'warden') for (const side of [-18, 18]) this.warning.lineBetween(enemy.x + nx * side, enemy.y + ny * side, ex + nx * side, ey + ny * side);
      else this.warning.lineBetween(enemy.x, enemy.y, ex, ey);
    }
  }
  private updateProjectiles(delta: number): void {
    for (const obj of [...this.shots.getChildren(), ...this.enemyShots.getChildren()]) {
      const shot = obj as Phaser.Physics.Arcade.Image;
      if (!shot.active) continue;
      if (shot instanceof ProjectileEntity) {
        const target = shot.getData('target') as PhantomEntity | undefined;
        if (target?.active) shot.steerTo(target, delta);
      }
      if (this.elapsed - Number(shot.getData('born') ?? 0) > 5000 || shot.x < -40 || shot.x > GAME_WIDTH + 40 || shot.y < 50 || shot.y > GAME_HEIGHT + 20) shot.destroy();
    }
  }
  private hurtPlayer(damage: number): boolean {
    if (this.paused || this.finished || this.intermissionMs > 0) return false;
    const hit = this.player.damage(damage);
    if (hit) this.cameras.main.shake(65, 0.002);
    return hit;
  }
  private useSkill(): void {
    if (this.paused || this.finished || this.skillClock > 0) return;
    const start = new Phaser.Math.Vector2(this.player.x, this.player.y);
    const end = start.clone().add(this.heading.clone().scale(COMBAT.dashDistance));
    end.x = Phaser.Math.Clamp(end.x, 35, GAME_WIDTH - 35); end.y = Phaser.Math.Clamp(end.y, 102, 472);
    this.player.setPosition(end.x, end.y); this.player.protect(COMBAT.dashInvulnerability);
    this.skillClock = COMBAT.dashCooldown;
    for (const obj of this.enemyShots.getChildren().slice()) {
      const shot = obj as Phaser.Physics.Arcade.Image;
      if (pointSegmentDistance(shot.x, shot.y, start.x, start.y, end.x, end.y) < 32) shot.destroy();
    }
    const trail = this.add.graphics().setDepth(5).lineStyle(4, 0x9ffff0, 0.8).lineBetween(start.x, start.y, end.x, end.y);
    this.tweens.add({ targets: trail, alpha: 0, duration: 220, onComplete: () => trail.destroy() });
  }
  private useHook(): void {
    if (this.paused || this.finished || this.economy.hooks <= 0) return;
    const target = this.aimTarget();
    if (!target) return;
    this.economy.hooks -= 1;
    if (!target.isBoss) {
      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, target.x, target.y);
      target.setPosition(this.player.x + Math.cos(angle) * 100, this.player.y + Math.sin(angle) * 100);
    }
    target.cancelCast(1100); this.hitEnemy(target, this.progression.state.attack * 2);
    this.floatText(this.player.x, this.player.y - 24, '钩爪打断', '#a4ffea');
  }
  private eatApple(): void {
    if (this.paused || this.finished || this.economy.apples <= 0 || this.player.health >= this.player.maxHealth) return;
    this.economy.apples -= 1; this.heal(this.player.maxHealth * 0.5);
  }
  private heal(amount: number): void {
    const actual = Math.min(amount, this.player.maxHealth - this.player.health);
    this.player.health += actual;
    if (actual > 0) this.floatText(this.player.x, this.player.y - 28, `+${Math.round(actual)}`, '#9cff95');
  }
  private dropPickup(x: number, y: number, kind: PickupKind, loot?: Loot): void {
    if (this.pickups.isFull()) { if (loot) this.grantLoot(loot); else this.buffMs = 6000; return; }
    const pickup = this.physics.add.image(Phaser.Math.Clamp(x, 30, GAME_WIDTH - 30), Phaser.Math.Clamp(y, 100, 472), 'enemyBolt')
      .setDisplaySize(kind === 'core' ? 16 : 10, kind === 'core' ? 16 : 10).setTint(kind === 'core' ? 0xffdd75 : 0x8fff70).setDepth(3);
    pickup.setData({ kind, loot }); this.pickups.add(pickup);
  }
  private pullPickups(): void {
    for (const obj of this.pickups.getChildren().slice()) {
      const pickup = obj as Phaser.Physics.Arcade.Image;
      if (!pickup.active) continue;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, pickup.x, pickup.y);
      if (distance < 32) { this.claimGroundLoot(pickup); continue; }
      if (distance < this.progression.state.magnet) {
        const angle = Phaser.Math.Angle.Between(pickup.x, pickup.y, this.player.x, this.player.y);
        pickup.setVelocity(Math.cos(angle) * 280, Math.sin(angle) * 280);
      } else pickup.setVelocity(0, 0);
    }
  }
  private claimGroundLoot(pickup: Phaser.Physics.Arcade.Image): void {
    if (!pickup.active) return;
    const kind = pickup.getData('kind') as PickupKind, loot = pickup.getData('loot') as Loot;
    pickup.destroy();
    if (kind === 'core') { this.buffMs = 6000; this.floatText(this.player.x, this.player.y - 28, '核心 · 伤害 +30%', '#ffe28a'); }
    else this.grantLoot(loot);
  }
  private grantLoot(loot: Loot): void {
    const before = this.player.maxHealth;
    const levels = this.economy.grant(loot.xp, loot.gems, this.progression);
    this.player.maxHealth = this.progression.state.maxHealth;
    this.heal(this.player.maxHealth - before + (levels ? 25 : loot.heal));
    if (levels) this.pendingUpgradePrompt = true;
  }
  private completeChapter(): void {
    this.pendingChapterClear = false;
    this.enemies.clear(true, true); this.enemyShots.clear(true, true); this.shots.clear(true, true); this.warning.clear(); this.locked = undefined;
    for (const obj of this.pickups.getChildren().slice()) this.claimGroundLoot(obj as Phaser.Physics.Arcade.Image);
    this.heal(this.player.maxHealth * 0.15);
    this.skillClock = 0; this.combo = 0; this.comboMs = 0;
    if (this.encounter.finished) { this.end(true); return; }
    this.intermissionMs = COMBAT.chapterRest;
    this.floatText(GAME_WIDTH / 2, 245, '章节完成 · 整理装备', '#ffe28a', 2000);
  }

  private createHud(): void {
    this.add.rectangle(0, 0, GAME_WIDTH, 86, 0x101b25).setOrigin(0).setDepth(10);
    this.add.rectangle(0, 488, GAME_WIDTH, 52, 0x101b25).setOrigin(0).setDepth(10);
    this.add.rectangle(20, 20, 180, 12, 0x342c36).setOrigin(0).setDepth(11);
    this.hpBar = this.add.rectangle(20, 20, 180, 12, 0x64d88b).setOrigin(0).setDepth(12);
    this.xpBar = this.add.rectangle(20, 40, 0, 5, 0xb89bef).setOrigin(0).setDepth(12);
    this.levelText = this.add.text(215, 16, '', { fontSize: '16px', color: '#fff1c7' }).setDepth(12);
    this.info = this.add.text(940, 16, '', { fontSize: '16px', color: '#fff1c7' }).setOrigin(1, 0).setDepth(12);
    this.bossName = this.add.text(480, 54, '', { fontSize: '15px', color: '#ffe28a' }).setOrigin(0.5, 0).setDepth(12);
    this.bossBar = this.add.rectangle(340, 77, 280, 5, 0xee8879).setOrigin(0).setDepth(12);
    const control = (x: number, label: string, action: () => void) => {
      const text = this.add.text(x, 500, label, { fontSize: '16px', color: '#cbefe4', backgroundColor: '#263e42', padding: { x: 12, y: 5 } }).setDepth(12).setInteractive({ useHandCursor: true });
      text.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); action(); });
      return text;
    };
    this.skillText = control(20, '冲刺 [空格]', () => this.useSkill());
    control(205, '锁定 [Q]', () => this.cycleLock());
    control(355, '钩爪 [F]', () => this.useHook());
    control(505, '治疗 [G]', () => this.eatApple());
    this.statusText = control(655, '商店 [E]', () => { if (!this.paused && !this.finished) this.economy.pendingUpgrades ? this.showUpgrade() : this.showShop(); });
    control(810, '暂停 [P]', () => this.togglePause());
  }
  private updateHud(): void {
    this.hpBar.width = 180 * Math.max(0, this.player.health / this.player.maxHealth);
    this.xpBar.width = 180 * this.progression.state.xp / this.progression.need();
    this.levelText.setText(`LV ${this.progression.state.level}  ${Math.ceil(this.player.health)}/${this.player.maxHealth}`);
    this.info.setText(`第 ${Math.min(5, this.encounter.chapterIndex + 1)} 章   击败 ${this.kills}   ${this.economy.gems} ◆`);
    this.skillText.setText(this.skillClock > 0 ? `冲刺 ${Math.ceil(this.skillClock / 1000)}s` : '冲刺 [空格]');
    this.statusText.setText(this.economy.pendingUpgrades ? `升级 ×${this.economy.pendingUpgrades}` : '商店 [E]');
    if (this.boss?.active) {
      this.bossName.setText(`${ENEMY_NAMES[this.boss.variant]} · ${this.boss.phase === 2 ? '第二阶段' : '第一阶段'}`);
      this.bossBar.setVisible(true); this.bossBar.width = 280 * this.boss.health / this.boss.maxHealth;
    } else {
      this.bossBar.setVisible(false);
      this.bossName.setText(this.intermissionMs > 0 ? `休整 ${Math.ceil(this.intermissionMs / 1000)}s · E 购买装备` : this.buffMs > 0 ? `核心强化 ${Math.ceil(this.buffMs / 1000)}s` : `自动攻击 · 移动躲避 · 首领进度 ${Math.min(12, this.encounter.killsThisChapter)}/12`);
    }
  }
  private panel(title: string): void {
    this.paused = true; this.physics.pause(); this.time.paused = true; this.tweens.pauseAll(); this.touchTarget = undefined;
    this.overlay?.destroy(); this.overlay = this.add.container(0, 0).setDepth(30);
    const blocker = this.add.rectangle(480, 270, 960, 540, 0x080e16, 0.78).setInteractive();
    blocker.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
    this.overlay.add(blocker);
    this.overlay.add(this.add.rectangle(480, 270, 760, 410, 0x202c33).setStrokeStyle(3, 0x728f7a));
    this.overlay.add(this.add.text(480, 120, title, { color: '#fff1c7', fontSize: '25px', fontStyle: 'bold' }).setOrigin(0.5));
  }
  private button(y: number, label: string, action: () => void, enabled = true): void {
    const b = this.add.text(480, y, label, { color: enabled ? '#e8ffe5' : '#8b9694', backgroundColor: '#344d45', fontSize: '17px', padding: { x: 20, y: 12 } }).setOrigin(0.5);
    if (enabled) b.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event.stopPropagation(); action(); });
    this.overlay!.add(b);
  }
  private closePanel(): void {
    this.overlay?.destroy(); this.overlay = undefined; this.paused = false;
    this.physics.resume(); this.time.paused = false; this.tweens.resumeAll();
  }
  private showUpgrade(): void {
    if (!this.economy.pendingUpgrades) return;
    this.panel('附魔台 · 选择本次升级');
    const choose = (id: EnchantId) => {
      const heal = this.economy.applyEnchant(id, this.progression.state);
      this.player.maxHealth = this.progression.state.maxHealth; this.heal(heal);
      this.economy.consumeUpgrade(); this.closePanel();
      if (this.economy.pendingUpgrades) this.showUpgrade();
    };
    this.economy.rollOffers().forEach((offer, index) => this.button(190 + index * 62, offer.label, () => choose(offer.id)));
    this.button(405, '稍后选择 · 候选保留', () => this.closePanel());
  }
  private showShop(): void {
    this.panel(`流浪商人 · ${this.economy.gems} 绿宝石`);
    const buy = (id: ShopId) => {
      if (!this.economy.purchase(id, this.progression.state).ok) return;
      this.showShop();
    };
    this.economy.catalog(this.progression.state.speed).forEach((offer, index) => this.button(180 + index * 56, offer.label, () => buy(offer.id), offer.available && this.economy.gems >= offer.price));
    this.button(424, '返回战场', () => this.closePanel());
  }
  private togglePause(): void {
    if (this.finished) return;
    if (this.paused) { if (this.overlay?.getData('pause')) this.closePanel(); return; }
    this.panel('暂停'); this.overlay!.setData('pause', true);
    this.button(245, '继续飞行', () => this.closePanel());
    this.button(320, '返回主界面', () => { this.closePanel(); this.scene.start('Menu'); });
  }
  private floatText(x: number, y: number, message: string, color: string, duration = 850): void {
    const text = this.add.text(x, y, message, { color, fontSize: '14px', stroke: '#12212b', strokeThickness: 3 }).setOrigin(0.5).setDepth(15);
    this.tweens.add({ targets: text, y: y - 24, alpha: 0, duration, onComplete: () => text.destroy() });
  }
  private end(won: boolean): void {
    if (this.finished) return;
    this.finished = true; this.player.setVelocity(0, 0);
    const best = this.save.load();
    this.save.save({ ...best, bestLevel: Math.max(best.bestLevel, this.progression.state.level), bestKills: Math.max(best.bestKills, this.kills) });
    this.panel(won ? '末地远征完成' : '飞行器损毁');
    this.overlay!.add(this.add.text(480, 215, `LV ${this.progression.state.level}  ·  击败 ${this.kills}  ·  ${Math.floor(this.elapsed / 1000)} 秒`, { color: '#fff1c7', fontSize: '18px' }).setOrigin(0.5));
    this.button(300, '重新试飞', () => { this.closePanel(); this.scene.restart(); });
    this.button(370, '返回主界面', () => { this.closePanel(); this.scene.start('Menu'); });
  }
}
