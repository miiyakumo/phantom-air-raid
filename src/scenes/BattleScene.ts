import Phaser from 'phaser';
import { GAME_COLORS, GAME_HEIGHT, GAME_WIDTH } from '../data/game-config';
import { PhantomEntity, PhantomVariant } from '../entities/PhantomEntity';
import { PlayerEntity } from '../entities/PlayerEntity';
import { ProjectileEntity } from '../entities/ProjectileEntity';
import { EncounterSystem, type WaveKind } from '../systems/EncounterSystem';
import { EconomySystem, type EnchantId, type ShopId } from '../systems/EconomySystem';
import { ProgressionSystem } from '../systems/ProgressionSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { drawPixelArena } from '../systems/Visuals';
import { ENEMY_NAMES } from '../data/enemy-recipes';

const NAMES = ENEMY_NAMES;

export class BattleScene extends Phaser.Scene {
  private player!: PlayerEntity; private enemies!: Phaser.Physics.Arcade.Group; private shots!: Phaser.Physics.Arcade.Group; private enemyShots!: Phaser.Physics.Arcade.Group; private pickups!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys; private keys!: Record<string, Phaser.Input.Keyboard.Key>; private progression = new ProgressionSystem(); private save = new SaveSystem(); private encounter = new EncounterSystem();
  private economy = new EconomySystem(); private skillClock = 0; private regenClock = 0; private statusText!: Phaser.GameObjects.Text; private skillText!: Phaser.GameObjects.Text;
  private fireClock = 0; private spawnClock = 0; private elapsed = 0; private kills = 0; private combo = 0; private comboClock = 0; private comboBank = 0; private comboGrace = 0; private surge = 0; private focus = 0; private surgeStock = 0; private focusStock = 0; private grazeCharge = 0; private heat = 0; private overheated = false; private afterburn = 0; private hover = false; private hoverLock = 0; private lockAge = 0; private conducting = false; private chainClock = 0; private chainAim = new Map<PhantomEntity, number>(); private reelClock = 0; private stall = 0; private strafing = false; private lastHeading = 0; private chargeClock = 0; private coverClock = 0; private bossCore = false; private coreClock = 0; private lastFlank = false; private stage = 0; private boss?: PhantomEntity; private bossGate = 0; private finalBossDefeated = false; private paused = false; private finished = false; private warning!: Phaser.GameObjects.Graphics; private touchX = 0; private touchY = 0; private touchActive = false; private lastPauseDown = false;
  private hpBar!: Phaser.GameObjects.Rectangle; private xpBar!: Phaser.GameObjects.Rectangle; private levelText!: Phaser.GameObjects.Text; private info!: Phaser.GameObjects.Text; private bossName!: Phaser.GameObjects.Text; private bossBar!: Phaser.GameObjects.Rectangle; private overlay?: Phaser.GameObjects.Container;

  constructor() { super('Battle'); }

  create(): void {
    this.volleyId = 0;
    this.fireDelay = 360;
    this.markTransfers = 0;
    this.lastHeading = 0;
    this.overlay = undefined;
    this.economy.reset(); this.skillClock = 0; this.regenClock = 0; this.touchActive = false; this.lastPauseDown = false; this.physics.resume(); this.progression = new ProgressionSystem(); this.fireClock = 0; this.spawnClock = 0; this.elapsed = 0; this.kills = 0; this.combo = 0; this.locked = undefined; this.lockMark = 0; this.comboClock = 0; this.comboBank = 0; this.comboGrace = 0; this.surge = 0; this.focus = 0; this.surgeStock = 0; this.focusStock = 0; this.grazeCharge = 0; this.heat = 0; this.overheated = false; this.afterburn = 0; this.hover = false; this.hoverLock = 0; this.lockAge = 0; this.conducting = false; this.chainClock = 0; this.chainAim.clear(); this.reelClock = 0; this.stall = 0; this.strafing = false; this.chargeClock = 0; this.coverClock = 0; this.bossCore = false; this.coreClock = 0; this.lastFlank = false; this.remedy = 0; this.remedyLife = 0; this.relicLife = 0; this.breachLife = 0; this.breachX = 0; this.breachY = 0; this.chainLife = 0; this.spiteLife = 0; this.spiteBoss = false; this.whiffLife = 0; this.whiffXp = 0; this.whiffGems = 0; this.whiffStance = 'still' as const; this.stage = 0; this.encounter.reset(); this.boss = undefined; this.bossGate = 0; this.finalBossDefeated = false; this.paused = false; this.finished = false;
    this.buildTextures(); this.cameras.main.setBackgroundColor(GAME_COLORS.ender); drawPixelArena(this); this.player = new PlayerEntity(this, GAME_WIDTH / 2, GAME_HEIGHT - 82); this.player.setData('speed', this.progression.state.speed);
    this.enemies = this.physics.add.group({ maxSize: 80 }); this.shots = this.physics.add.group({ maxSize: 60 }); this.enemyShots = this.physics.add.group({ maxSize: 60 }); this.pickups = this.physics.add.group({ maxSize: 28 }); this.cursors = this.input.keyboard!.createCursorKeys(); this.keys = this.input.keyboard!.addKeys('W,A,S,D,P,E,R,Q,F,SHIFT,CTRL,SPACE,C,ONE,TWO,THREE,FOUR,V,X,Z,G,B,H,N,M,J,K,U,I,O,L,Y,T') as unknown as Record<string, Phaser.Input.Keyboard.Key>;
    this.physics.add.overlap(this.shots, this.enemies, this.onShotHit, undefined, this); this.physics.add.overlap(this.player, this.enemies, this.onEnemyContact, undefined, this); this.physics.add.overlap(this.player, this.enemyShots, this.onEnemyShotHit, undefined, this); this.physics.add.overlap(this.enemyShots, this.enemies, this.onFriendlyShot, undefined, this);
    this.warning = this.add.graphics().setDepth(2); this.createHud(); this.spawnEnemy(160, 110, 'phantom'); this.spawnEnemy(GAME_WIDTH / 2, 80, 'phantom'); this.spawnEnemy(GAME_WIDTH - 160, 110, 'phantom');
    const feedback = [
      ['shield-turned', '绕后 · 盾面跟上', '#ffe28a'],
      ['shield-held', '正面压住 · 盾不转', '#ffb0b0'],
      ['skill-fed', '站在正面 · 技能回充', '#ffb0b0'],
      ['skill-starved', '不在正面 · 技能拖慢', '#ffe28a'],
      ['face-turned', '绕到背后 · 转过来', '#ffe28a'],
      ['face-held', '留在正面 · 没转身', '#ffb0b0'],
      ['orbit-flipped', '穿到另一侧 · 绕圈反向', '#ffe28a'],
      ['orbit-held', '没穿过去 · 绕圈不变', '#ffb0b0'],
      ['chase-lost', '离开正面 · 追丢', '#ffe28a'],
      ['chase-caught', '回到正面 · 又锁住', '#ffb0b0'],
      ['rage-leashed', '贴住狂暴 · 拖慢', '#ffe28a'],
      ['rage-loose', '拉开狂暴 · 加速', '#ffb0b0'],
      ['rage-calmed', '侧翼周旋 · 怒火平息', '#ffe28a'],
      ['rage-fueled', '拉开逃跑 · 怒火难消', '#ffb0b0'],
      ['expose-held', '贴住背后 · 破绽拖住', '#ffe28a'],
      ['expose-burst', '站到正面 · 破绽前冲', '#ffb0b0'],
      ['expose-front', '站在正面 · 破绽压住', '#ffe28a'],
      ['expose-front-lost', '离开正面 · 破绽在合', '#ffb0b0'],
    ].map(([event, message, color]) => {
      const handler = (x: number, y: number) => this.floatText(x, y - 18, message, color);
      this.events.on(event, handler);
      return { event, handler };
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const { event, handler } of feedback) this.events.off(event, handler);
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => { if (pointer.isDown && !this.paused && !this.finished) { this.touchX = Phaser.Math.Clamp(pointer.x, 30, GAME_WIDTH - 30); this.touchY = Phaser.Math.Clamp(pointer.y, 72, GAME_HEIGHT - 30); this.touchActive = true; } }); this.input.on('pointerup', () => { this.touchActive = false; });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.paused || this.finished || pointer.y < 64) return;
      let picked: PhantomEntity | undefined;
      let best = 42;
      this.enemies.children.each((obj) => {
        const enemy = obj as PhantomEntity;
        if (!enemy.active || enemy.health <= 0) return true;
        const distance = Phaser.Math.Distance.Between(pointer.x, pointer.y, enemy.x, enemy.y);
        if (distance < best) { best = distance; picked = enemy; }
        return true;
      });
      if (!picked) return;
      this.locked = this.locked === picked ? undefined : picked;
      this.markTransfers = 0; this.lockMark = 0; this.lockAge = 0;
      if (this.locked) this.floatText(this.locked.x, this.locked.y - 24, '锁定', '#fff1c7');
    });
  }

  update(_time: number, delta: number): void {
    if (this.finished) return; if (Phaser.Input.Keyboard.JustDown(this.keys.P) && (!this.paused || this.overlay?.getData('pause'))) this.togglePause(); if (this.paused) return; if (Phaser.Input.Keyboard.JustDown(this.keys.E)) { if (this.economy.pendingUpgrades) this.showUpgrade(); else this.showShop(); return; } if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) this.cycleLock(); if (Phaser.Input.Keyboard.JustDown(this.keys.F)) this.useHook(); if (Phaser.Input.Keyboard.JustDown(this.keys.C)) this.reelChain(); if (Phaser.Input.Keyboard.JustDown(this.keys.ONE)) this.crackBuff('surge'); if (Phaser.Input.Keyboard.JustDown(this.keys.TWO)) this.crackBuff('focus'); if (Phaser.Input.Keyboard.JustDown(this.keys.THREE)) this.cashCombo(); if (Phaser.Input.Keyboard.JustDown(this.keys.FOUR)) this.slamCore(); if (Phaser.Input.Keyboard.JustDown(this.keys.V)) this.parryShot(); if (Phaser.Input.Keyboard.JustDown(this.keys.X)) this.detonateNow(); if (Phaser.Input.Keyboard.JustDown(this.keys.G)) this.eatApple(); if (Phaser.Input.Keyboard.JustDown(this.keys.H)) this.useRemedy(); this.expireRemedy(delta); if (this.relicLife > 0 && Phaser.Input.Keyboard.JustDown(this.keys.ONE)) this.claimRelic('surge'); if (this.relicLife > 0 && Phaser.Input.Keyboard.JustDown(this.keys.TWO)) this.claimRelic('focus'); this.expireRelic(delta); if (this.breachLife > 0 && Phaser.Input.Keyboard.JustDown(this.keys.J)) this.claimBreach('spread'); if (this.breachLife > 0 && Phaser.Input.Keyboard.JustDown(this.keys.K)) this.claimBreach('loot'); this.expireBreach(delta); if (this.chainLife > 0 && Phaser.Input.Keyboard.JustDown(this.keys.U)) this.claimChain('stack'); if (this.chainLife > 0 && Phaser.Input.Keyboard.JustDown(this.keys.I)) this.claimChain('cash'); this.expireChain(delta); if (this.spiteLife > 0 && Phaser.Input.Keyboard.JustDown(this.keys.O)) this.claimSpite('vent'); if (this.spiteLife > 0 && Phaser.Input.Keyboard.JustDown(this.keys.L)) this.claimSpite('cash'); this.expireSpite(delta); this.reapWhiff(delta); if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.useSkill(); this.rechargeDash(delta); const guard = this.locked?.active ? this.locked : undefined;
    const behind = !!guard && Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(guard.x, guard.y, this.player.x, this.player.y) - (guard.flipX ? Math.PI : 0) - Math.PI)) <= 0.9 && Phaser.Math.Distance.Between(this.player.x, this.player.y, guard.x, guard.y) <= 120;
    this.comboClock = Math.max(0, this.comboClock - ((this.keys.U.isDown && behind) ? 0 : delta * (behind ? 0.35 : 1.6)));
    if (this.combo > 0 && behind && !this.player.getData('comboHeld')) { this.player.setData('comboHeld', 1); this.floatText(this.player.x, this.player.y - 18, '贴背保住连击', '#ffe28a'); }
    else if (this.combo > 0 && !behind && this.player.getData('comboHeld') !== 2) { this.player.setData('comboHeld', 2); this.floatText(this.player.x, this.player.y - 18, '离开背后 · 连击快掉', '#ffb0b0'); }
    else if (this.combo <= 0) this.player.setData('comboHeld', 0); if (this.comboClock <= 0 && this.combo > 0) { if (this.economy.hooks > 0) { this.comboBank = this.combo; this.comboGrace = 2000; this.player.setData('comboDropX', this.player.x); this.player.setData('comboDropY', this.player.y); } this.combo = 0; } const dropNear = this.comboBank > 0 && Phaser.Math.Distance.Between(this.player.x, this.player.y, Number(this.player.getData('comboDropX') ?? this.player.x), Number(this.player.getData('comboDropY') ?? this.player.y)) <= 90; if (this.comboBank > 0 && dropNear && this.player.getData('comboStay') !== 1) { this.player.setData('comboStay', 1); this.floatText(this.player.x, this.player.y - 18, '留在断连处 · 追回还在', '#ffe28a'); } else if (this.comboBank > 0 && !dropNear && this.player.getData('comboStay') !== 2) { this.player.setData('comboStay', 2); this.floatText(this.player.x, this.player.y - 18, '离开断连处 · 追回快没', '#ffb0b0'); } else if (this.comboBank <= 0) this.player.setData('comboStay', 0); this.comboGrace = Math.max(0, this.comboGrace - delta * (dropNear ? 0.45 : 2.1)); if (this.comboGrace <= 0) this.comboBank = 0; const flight = this.player.body?.velocity;
    const moving = !!flight && flight.lengthSq() > 400;
    const heading = moving ? Math.atan2(flight.y, flight.x) : this.lastHeading;
    const turning = moving && Math.abs(Phaser.Math.Angle.Wrap(heading - this.lastHeading)) > 0.35;
    if (moving) this.lastHeading = heading;
    const buffRate = turning ? 0.35 : 1.8;
    if ((this.surge > 0 || this.focus > 0) && turning && !this.player.getData('buffTurn')) { this.player.setData('buffTurn', 1); this.floatText(this.player.x, this.player.y - 18, '转向续住附魔', '#ffe28a'); }
    else if ((this.surge > 0 || this.focus > 0) && !turning && this.player.getData('buffTurn') !== 2) { this.player.setData('buffTurn', 2); this.floatText(this.player.x, this.player.y - 18, '直线飞 · 附魔掉得快', '#ffb0b0'); }
    else if (this.surge <= 0 && this.focus <= 0) this.player.setData('buffTurn', 0);
    this.surge = Math.max(0, this.surge - delta * buffRate); this.focus = Math.max(0, this.focus - delta * buffRate); const rushFlight = this.player.body?.velocity;
    const rushing = !!rushFlight && rushFlight.lengthSq() > 400;
    const straight = rushing && !this.strafing;
    const afterburnRate = straight ? 0.4 : 2.2;
    if (this.afterburn > 0 && straight && !this.player.getData('afterburnHeld')) { this.player.setData('afterburnHeld', 1); this.floatText(this.player.x, this.player.y - 18, '直冲续住余热', '#ffe28a'); }
    else if (this.afterburn > 0 && !straight && this.player.getData('afterburnHeld') !== 2) { this.player.setData('afterburnHeld', 2); this.floatText(this.player.x, this.player.y - 18, '横飞停步 · 余热消散', '#ffb0b0'); }
    else if (this.afterburn <= 0) this.player.setData('afterburnHeld', 0);
    this.afterburn = Math.max(0, this.afterburn - delta * afterburnRate);  this.elapsed += delta; this.advanceChapter(delta); this.fireClock -= delta; this.spawnClock -= delta; this.updateStall(delta, this.movePlayer()); this.warning.clear(); this.drawLock(); this.drawHeatRadius();
    const bleeding = this.keys.Y.isDown;
    const ventTarget = bleeding ? (this.enemies.getChildren() as PhantomEntity[]).find((enemy) => enemy.active && enemy.abilityActive && enemy.abilityElapsed <= enemy.getTelegraphDuration() && Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) <= 85) : undefined;
    if (bleeding && ventTarget) {
      this.heat = Math.max(0, this.heat - delta * 0.09);
      if (!this.player.getData('venting')) { this.player.setData('venting', 1); this.floatText(ventTarget.x, ventTarget.y - 18, '极限散热', '#b8fff4'); }
    } else if (bleeding) {
      this.heat = Math.max(0, this.heat - delta * 0.05);
      if (this.player.getData('venting')) this.player.setData('venting', 0);
    } else {
      if (this.player.getData('venting')) this.player.setData('venting', 0);
      this.heat = Math.max(0, this.heat - delta * (this.overheated ? 0.032 : 0.024));
    }
    if (this.overheated && this.heat <= 35) this.overheated = false; this.updateHover(delta); this.updateGrudge(delta); this.updateChains(delta); this.updateReel(delta); this.updateCore(delta); this.chargeLinks(delta); this.recoverCover(delta); this.pressReads(delta); this.contestPhase(delta);
    const wantFire = this.keys.J.isDown && !this.keys.SHIFT.isDown && !this.keys.Y.isDown && this.stall < 180;
    if (wantFire && !this.overheated && this.fireClock <= 0) {
      this.fire();
      this.heat = Math.min(100, this.heat + Math.max(4, (this.strafing ? 18 : 11) + (this.focus > 0 ? 7 : 0) - this.progression.state.vent));
      if (this.heat >= 100) { this.overheated = true; this.floatText(this.player.x, this.player.y - 24, '过热', '#ffb0b0'); }
      this.fireClock = this.fireDelay;
    } if (this.spawnClock <= 0) {
      const activeCount = this.enemies.countActive();
      const called = this.encounter.takeWave(this.stall >= 900 ? "hold" : this.strafing ? "strafe" : "rush");
      if (called) {
        this.spawnWave(called.kind, called.label);
      } else {
        this.spawnAtEdge();
        if (activeCount < 3) this.spawnAtEdge();
      }
      this.enemyGap();
      this.spawnClock = Math.max(260, 680 - this.elapsed / 6000);
    }
    this.enemies.children.each((obj) => { const enemy = obj as PhantomEntity; if (!enemy.active) return true; enemy.updateAI(this.player, delta); this.holdLink(enemy); if (!enemy.abilityActive) { enemy.setData('burst', 0); enemy.setData('cross', 0); enemy.setData('witherCall', 0); } this.drawWarning(enemy); this.resolveAbility(enemy, delta); if (!enemy.isBoss && (enemy.x < -40 || enemy.x > GAME_WIDTH + 40 || enemy.y < 30 || enemy.y > GAME_HEIGHT + 40)) {
        const edgeDist = Math.min(this.player.x, GAME_WIDTH - this.player.x, this.player.y, GAME_HEIGHT - this.player.y);
        const intercepted = edgeDist <= 110 && Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) <= 180;
        if (intercepted) {
          this.economy.gems += 1;
          this.floatText(this.player.x, this.player.y - 20, '边缘截击 +1 ◆', '#7dff63');
          enemy.destroy();
        } else if (enemy.x < -120 || enemy.x > GAME_WIDTH + 120 || enemy.y < -120 || enemy.y > GAME_HEIGHT + 120) {
          enemy.x = enemy.x < -120 ? GAME_WIDTH + 20 : enemy.x > GAME_WIDTH + 120 ? -20 : enemy.x;
          enemy.y = enemy.y < -120 ? GAME_HEIGHT + 20 : enemy.y > GAME_HEIGHT + 120 ? 60 : enemy.y;
          enemy.enrage(1400);
          this.floatText(this.player.x, this.player.y - 20, '没截住 · 敌人绕背', '#ffb0b0');
        }
      }
      if (enemy.isBoss) { enemy.x = Phaser.Math.Clamp(enemy.x, 52, GAME_WIDTH - 52); enemy.y = Phaser.Math.Clamp(enemy.y, 90, GAME_HEIGHT - 52); } return true; });
    this.shots.children.each((obj) => { const shot = obj as ProjectileEntity; const target = shot.getData('target') as PhantomEntity | undefined; if (!shot.active) return true; if (target?.active && !this.finalBossDefeated) { const before = Math.atan2(shot.body?.velocity.y ?? 0, shot.body?.velocity.x ?? 1); const riding = this.keys.R.isDown; shot.steerTo(target, delta, riding ? this.player : undefined); const after = Math.atan2(shot.body?.velocity.y ?? 0, shot.body?.velocity.x ?? 1); const turned = Math.abs(Phaser.Math.Angle.Wrap(after - before)) > 0.001; if (riding && turned) { this.heat = Math.min(100, this.heat + delta * 0.012); if (this.heat >= 100 && !this.overheated) { this.overheated = true; this.floatText(this.player.x, this.player.y - 24, '牵引过热', '#ffb0b0'); } if (!shot.getData('guided')) { shot.setData('guided', 1); this.floatText(shot.x, shot.y - 14, '停上弹道 · 继续拐弯', '#d7ecff'); } } else if (riding && shot.getData('guided')) { shot.setData('guided', 0); this.floatText(shot.x, shot.y - 14, '离开弹道 · 不再拐弯', '#ffb0b0'); } else if (!riding && shot.getData('guided')) { shot.setData('guided', 0); this.floatText(shot.x, shot.y - 14, '松开牵引 · 弹道拉直', '#ffb0b0'); } } const cover = this.blocksPlayerShot(shot, target); if (cover) { this.absorbPlayerShot(shot, cover); return true; } if (shot.x < -50 || shot.x > GAME_WIDTH + 50 || shot.y < -50 || shot.y > GAME_HEIGHT + 50) shot.destroy(); return true; }); this.enemyShots.children.each((obj) => { const shot = obj as Phaser.Physics.Arcade.Image; if (!shot.active) return true; const cover = this.blocksShot(shot); if (cover) { this.absorbCover(shot, cover); return true; } const leaving = shot.x < -20 || shot.x > GAME_WIDTH + 20 || shot.y < 40 || shot.y > GAME_HEIGHT + 20;
        if (leaving) {
          const exitLeft = shot.x < GAME_WIDTH / 2;
          const exitTop = shot.y < GAME_HEIGHT / 2;
          const guarding = (shot.x < 0 || shot.x > GAME_WIDTH) ? Math.abs(this.player.x - (exitLeft ? 0 : GAME_WIDTH)) <= 140 : Math.abs(this.player.y - (exitTop ? 70 : GAME_HEIGHT)) <= 140;
          if (guarding || Number(shot.getData('friendly') ?? 0) > 0) shot.destroy();
          else if (shot.x < -80 || shot.x > GAME_WIDTH + 80 || shot.y < -80 || shot.y > GAME_HEIGHT + 80) {
            const vx = shot.body?.velocity.x ?? 0;
            const vy = shot.body?.velocity.y ?? 0;
            shot.x = shot.x < -80 ? GAME_WIDTH - 30 : shot.x > GAME_WIDTH + 80 ? 30 : shot.x;
            shot.y = shot.y < -80 ? GAME_HEIGHT - 30 : shot.y > GAME_HEIGHT + 80 ? 90 : shot.y;
            shot.setVelocity(-vx, -vy);
            this.floatText(shot.x, shot.y - 16, '没守边 · 弹幕折返', '#ffb0b0');
          }
        } return true; });
    this.pullPickups();
    this.grazeShots();
    this.updateHud(); if (this.player.health <= 0) this.end(false); if (!this.boss && this.encounter.shouldSpawnBoss()) {
      const edge = Math.min(this.player.x, GAME_WIDTH - this.player.x, this.player.y, GAME_HEIGHT - this.player.y) <= 90;
      const centered = Phaser.Math.Distance.Between(this.player.x, this.player.y, GAME_WIDTH / 2, GAME_HEIGHT / 2) <= 120;
      const boss = this.spawnBoss(this.encounter.bossVariant()!);
      if (edge && this.bossGate !== 2) {
        this.bossGate = 2;
        boss.enrage(2000);
        this.floatText(this.player.x, this.player.y - 24, '狭路相逢 · Boss 狂暴降临！', '#ff7a8a');
      } else if (centered) {
        this.floatText(this.player.x, this.player.y - 24, '正中迎击 · 领主降临！', '#ffe28a');
      } else {
        this.floatText(this.player.x, this.player.y - 24, '强敌警报 · 领主降临！', '#ffe28a');
      }
    } if (this.finalBossDefeated && Phaser.Input.Keyboard.JustDown(this.keys.R)) this.end(true);
  }

  private buildTextures(): void { if (this.textures.exists('fireworkPhantom')) return; const g = this.make.graphics({ x: 0, y: 0 }); g.fillStyle(0x25b7c7).fillRect(4, 12, 56, 16).fillStyle(0x4c76c9).fillRect(15, 4, 30, 34).fillStyle(0xe8d48b).fillRect(0, 16, 10, 8).fillStyle(0x7ce9ff).fillRect(25, 10, 10, 12); g.generateTexture('player', 64, 42); g.clear(); g.fillStyle(0x526eac).fillTriangle(2, 16, 28, 2, 25, 22).fillTriangle(62, 16, 36, 2, 39, 22).fillStyle(0x7d5bc0).fillRect(24, 11, 18, 13).fillStyle(0xc4b0ed).fillRect(28, 14, 4, 4); g.generateTexture('phantom', 64, 26); g.clear(); g.fillStyle(0x526eac).fillTriangle(2, 21, 28, 2, 26, 28).fillTriangle(62, 21, 36, 2, 38, 28).fillStyle(0x4a9b54).fillRect(22, 8, 22, 24).fillStyle(0x4a3427).fillRect(27, 28, 7, 8).fillRect(37, 28, 7, 8); g.generateTexture('riderPhantom', 64, 38); g.clear(); g.fillStyle(0x526eac).fillTriangle(2, 23, 28, 4, 26, 30).fillTriangle(62, 23, 36, 4, 38, 30).fillStyle(0x41b849).fillRect(21, 9, 23, 25).fillStyle(0x15251a).fillRect(25, 16, 4, 5).fillRect(36, 16, 4, 5); g.generateTexture('creeperPhantom', 64, 40); g.clear(); g.fillStyle(0x526eac).fillTriangle(2, 21, 28, 2, 26, 28).fillTriangle(62, 21, 36, 2, 38, 28).fillStyle(0xd84c4c).fillRect(22, 8, 22, 24).fillStyle(0xffe6e6).fillRect(28, 2, 8, 7); g.generateTexture('fireworkPhantom', 64, 40); g.clear(); g.fillStyle(0x30233f).fillTriangle(2, 22, 28, 2, 26, 31).fillTriangle(62, 22, 36, 2, 38, 31).fillStyle(0x6f52a5).fillRect(20, 8, 24, 25).fillStyle(0x25182d).fillCircle(27, 17, 5).fillCircle(39, 17, 5); g.generateTexture('witherPhantom', 64, 42); g.clear(); g.fillStyle(0x1d3a3d).fillTriangle(2, 24, 28, 3, 26, 33).fillTriangle(62, 24, 36, 3, 38, 33).fillStyle(0x167b78).fillRect(20, 7, 24, 27).fillStyle(0x53e5d0).fillRect(27, 13, 10, 5); g.generateTexture('wardenPhantom', 64, 44); g.clear(); g.fillStyle(0x40d9e7).fillRect(2, 3, 22, 5).fillStyle(0xd3faff).fillRect(8, 4, 12, 3); g.generateTexture('trident', 26, 11); g.generateTexture('enemyBolt', 16, 16); g.destroy(); }
  private drawArena(): void { const g = this.add.graphics(); g.fillStyle(0x634e91).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT); g.fillStyle(0x7357a5, 0.55).fillCircle(130, 150, 100).fillCircle(820, 120, 130); for (let i = 0; i < 16; i += 1) { const x = Phaser.Math.Between(25, GAME_WIDTH - 25); const y = Phaser.Math.Between(75, GAME_HEIGHT - 35); g.fillStyle(i % 2 ? 0x9a82c7 : 0x45386d, 0.7).fillRect(x, y, Phaser.Math.Between(8, 24), Phaser.Math.Between(5, 12)); } g.lineStyle(3, 0x9f79bd, 0.8).strokeRect(12, 58, GAME_WIDTH - 24, GAME_HEIGHT - 72); }
  private createHud(): void { this.statusText = this.add.text(20, GAME_HEIGHT - 28, '', { fontSize: '16px', color: '#baffb0', backgroundColor: '#182922' }).setDepth(10).setInteractive(); this.statusText.on('pointerdown', () => { if (!this.paused) this.showShop(); }); this.skillText = this.add.text(GAME_WIDTH - 20, GAME_HEIGHT - 28, '', { fontSize: '16px', color: '#9affff', backgroundColor: '#182922' }).setOrigin(1, 0).setDepth(10).setInteractive(); this.skillText.on('pointerdown', () => this.useSkill()); this.add.rectangle(18, 16, 180, 18, 0x241631).setOrigin(0, 0).setStrokeStyle(2, 0xffd467); this.hpBar = this.add.rectangle(20, 18, 176, 14, 0x39c66d).setOrigin(0, 0); this.add.text(20, 38, '生命', { color: '#fff1c7', fontSize: '13px' }); this.levelText = this.add.text(220, 18, 'LV 1', { color: '#ffe28a', fontSize: '18px', fontStyle: 'bold' }); this.add.rectangle(300, 16, 180, 18, 0x241631).setOrigin(0, 0).setStrokeStyle(2, 0xffd467); this.xpBar = this.add.rectangle(302, 18, 0, 14, 0x9c70f1).setOrigin(0, 0); this.add.text(300, 38, '经验', { color: '#fff1c7', fontSize: '13px' }); this.info = this.add.text(GAME_WIDTH - 20, 18, '击败 0', { color: '#fff1c7', fontSize: '17px' }).setOrigin(1, 0); this.bossName = this.add.text(GAME_WIDTH / 2, 54, '', { color: '#ffe28a', fontSize: '17px', fontStyle: 'bold' }).setOrigin(0.5); this.bossBar = this.add.rectangle(GAME_WIDTH / 2, 78, 280, 10, 0xb53d48).setOrigin(0.5).setVisible(false); const pause = this.add.text(GAME_WIDTH - 20, 48, 'Ⅱ', { color: '#fff1c7', fontSize: '22px' }).setOrigin(1, 0).setInteractive({ useHandCursor: true }); pause.on('pointerdown', () => this.togglePause()); }
  private movePlayer(): boolean { let x = 0; let y = 0; if (this.touchActive) { x = this.touchX - this.player.x; y = this.touchY - this.player.y; } else { if (this.cursors.left.isDown || this.keys.A.isDown) x -= 1; if (this.cursors.right.isDown || this.keys.D.isDown) x += 1; if (this.cursors.up.isDown || this.keys.W.isDown) y -= 1; if (this.cursors.down.isDown || this.keys.S.isDown) y += 1; } const v = new Phaser.Math.Vector2(x, y); if (v.lengthSq() < 1) { this.player.setVelocity(0, 0); return false; } v.normalize().scale(this.progression.state.speed * (this.player.hurt ? 0.45 : 1) * (this.hover ? 0.62 : 1)); this.player.setVelocity(v.x, v.y); return true; }
  private volleyId = 0; private fireDelay = 360; private locked?: PhantomEntity; private lockMark = 0; private markTransfers = 0; private remedy = 0; private remedyLife = 0; private relicLife = 0; private breachLife = 0; private breachX = 0; private breachY = 0; private chainLife = 0; private spiteLife = 0; private spiteBoss = false; private whiffLife = 0; private whiffXp = 0; private whiffGems = 0; private whiffStance: 'strafe' | 'rush' | 'still' = 'still';
  private fire(): void {
    const target = this.aimTarget(); if (!target) return;
    if (this.locked === target) {
      const targetBody = target.body as Phaser.Physics.Arcade.Body | undefined;
      const targetVelocity = new Phaser.Math.Vector2(targetBody?.velocity.x ?? 0, targetBody?.velocity.y ?? 0);
      const targetMoving = targetVelocity.lengthSq() > 400;
      const toTarget = new Phaser.Math.Vector2(target.x - this.player.x, target.y - this.player.y);
      const onLane = targetMoving && Math.abs(toTarget.dot(new Phaser.Math.Vector2(-targetVelocity.y, targetVelocity.x).normalize())) <= 34;
      if (onLane) this.lockMark = Math.min(2000, this.lockMark + this.progression.state.fireInterval);
      else {
        this.lockMark = Math.max(0, this.lockMark - this.progression.state.fireInterval);
        if (targetMoving && !target.getData('markSlid')) { target.setData('markSlid', 1); this.floatText(target.x, target.y - 18, '离开航线 · 标记下滑', '#ffb0b0'); }
        else if (!targetMoving) target.setData('markSlid', 0);
      }
      if (onLane && target.getData('markSlid')) { target.setData('markSlid', 0); this.floatText(target.x, target.y - 18, '压回航线 · 标记上涨', '#ffe28a'); }
    } else this.lockMark = 0;
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);
    const velocity = this.player.body?.velocity;
    const moving = !!velocity && velocity.lengthSq() > 400;
    const targetBody2 = target.body as Phaser.Physics.Arcade.Body | undefined;
    const targetVel2 = new Phaser.Math.Vector2(targetBody2?.velocity.x ?? 0, targetBody2?.velocity.y ?? 0);
    const targetMoving2 = targetVel2.lengthSq() > 400;
    const toTarget2 = new Phaser.Math.Vector2(target.x - this.player.x, target.y - this.player.y);
    const crossing = targetMoving2 && Math.abs(toTarget2.dot(new Phaser.Math.Vector2(-targetVel2.y, targetVel2.x).normalize())) <= 34;
    const leadTime = moving || !crossing ? 0 : Phaser.Math.Clamp(distance / 420, 0, 0.42);
    if (!moving && targetMoving2 && !target.getData('leadCall')) {
      target.setData('leadCall', 1);
      this.floatText(target.x, target.y - 18, crossing ? '停在航线上 · 提前量' : '没压住航线 · 直射', crossing ? '#ffe28a' : '#ffb0b0');
    } else if ((moving || !targetMoving2) && target.getData('leadCall')) target.setData('leadCall', 0);
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y,
      target.x + targetVel2.x * leadTime,
      target.y + targetVel2.y * leadTime);
    const count = this.progression.state.projectileCount;
    const drift = moving ? Math.abs(Math.cos(Math.atan2(velocity.y, velocity.x) - angle)) : 1;
    this.strafing = moving && drift < 0.45;
    const spendGraze = this.keys.CTRL.isDown && this.grazeCharge > 0 && moving && drift > 0.82;
    const spread = (distance < 190 ? 0.11 : 0.075) * (spendGraze ? 1 + this.grazeCharge : 1) * (this.strafing ? 0.45 : drift > 0.82 ? 2.4 : 1);
    const center = Math.floor(count / 2); const volley = ++this.volleyId;
    for (let i = 0; i < count; i += 1) {
      if ((this.surge > 0 || !this.strafing || !this.keys.C.isDown) && i !== center) continue;
      const offset = (i - (count - 1) / 2) * spread;
      const launchAngle = angle + offset;
      const coefficient = count === 1 ? 1 : i === center ? 0.8 : 0.6 / (count - 1);
      const surgeBonus = this.surge > 0 ? 1.65 : 1;
      const grazeBonus = spendGraze ? 1 + 0.35 * this.grazeCharge : 1;
      const closeBand = this.hover ? 96 : this.progression.state.closeRange; const close = !moving && distance <= closeBand ? 1 + this.progression.state.closeDamage + (this.heat >= 70 ? 0.5 : 0) + (this.afterburn > 0 ? 0.4 : 0) + (this.hover ? 0.55 : 0) : 1;
      const comboBonus = 1 + Math.min(8, this.combo) * this.progression.state.comboPower;
      const shot = new ProjectileEntity(this, this.player.x, this.player.y, launchAngle);
      shot.setData('damage', this.progression.state.attack * coefficient * close * comboBonus * surgeBonus * grazeBonus * (this.strafing ? 1 + this.progression.state.flankStance : 1));
      shot.setData('pierce', this.progression.state.pierce);
      shot.setData('target', target); shot.setData('volley', volley); shot.setData('guide', this.afterburn > 0 ? 0 : this.strafing ? 1.8 : drift > 0.82 ? 0 : 1);
      this.shots.add(shot);
      // Explicit post-group launch fixes the intermittent stationary opening shot.
      shot.launch(launchAngle);
    }
    if (spendGraze) this.grazeCharge = 0;
    const rushing = moving && drift > 0.82;
    this.fireDelay = this.progression.state.fireInterval * (this.focus > 0 ? 0.55 : 1) * (rushing ? Math.max(0.6, 1 - this.progression.state.rushStance) : 1);
  }
  private aimTarget(): PhantomEntity | undefined {
    if (this.locked?.active && this.locked.health > 0 && this.locked.x >= 0 && this.locked.x <= GAME_WIDTH && this.locked.y >= 55 && this.locked.y <= GAME_HEIGHT) return this.locked;
    this.locked = undefined;
    return this.nearestVisible();
  }

  private cycleLock(): void {
    const list: PhantomEntity[] = [];
    this.enemies.children.each((obj) => {
      const enemy = obj as PhantomEntity;
      if (enemy.active && enemy.health > 0 && enemy.x >= 0 && enemy.x <= GAME_WIDTH && enemy.y >= 55 && enemy.y <= GAME_HEIGHT) list.push(enemy);
      return true;
    });
    if (list.length === 0) { this.locked = undefined; return; }
    list.sort((a, b) => Phaser.Math.Distance.Between(this.player.x, this.player.y, a.x, a.y) - Phaser.Math.Distance.Between(this.player.x, this.player.y, b.x, b.y));
    const next = list.find((enemy) => enemy !== this.locked) ?? list[0];
    const close = Phaser.Math.Distance.Between(this.player.x, this.player.y, next.x, next.y) <= 110;
    if (!close) {
      this.locked = undefined;
      this.lockMark = 0;
      this.lockAge = 0;
      const away = Phaser.Math.Angle.Between(next.x, next.y, this.player.x, this.player.y);
      this.player.setPosition(Phaser.Math.Clamp(this.player.x + Math.cos(away) * 48, 28, GAME_WIDTH - 28), Phaser.Math.Clamp(this.player.y + Math.sin(away) * 48, 78, GAME_HEIGHT - 28));
      this.floatText(next.x, next.y - 24, '离太远 · 锁定甩开', '#ffb0b0');
      return;
    }
    this.locked = next;
    this.markTransfers = 0; this.lockMark = 0; this.lockAge = 0;
    this.floatText(this.locked.x, this.locked.y - 24, '贴身锁定', '#fff1c7');
  }

  private nearestVisible(): PhantomEntity | undefined {
    let found: PhantomEntity | undefined;
    let best = Infinity;
    const flight = this.player.body?.velocity;
    const moving = !!flight && flight.lengthSq() > 400;
    const flightNorm = moving ? new Phaser.Math.Vector2(flight.x, flight.y).normalize() : new Phaser.Math.Vector2();
    this.enemies.children.each((obj) => {
      const e = obj as PhantomEntity;
      if (!e.active || e.health <= 0 || e.x < 0 || e.x > GAME_WIDTH || e.y < 55 || e.y > GAME_HEIGHT) return true;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      const windingUp = e.isBoss && e.abilityActive && e.abilityElapsed <= e.getTelegraphDuration();
      let alignDiscount = 0;
      if (moving && distance > 20) {
        const toEnemy = new Phaser.Math.Vector2(e.x - this.player.x, e.y - this.player.y).normalize();
        const dot = flightNorm.dot(toEnemy);
        if (this.strafing) {
          const sideDot = Math.abs(-flightNorm.y * toEnemy.x + flightNorm.x * toEnemy.y);
          alignDiscount = sideDot * 90;
        } else if (dot > 0.4) {
          alignDiscount = dot * 120;
        }
      }
      const score = distance - alignDiscount + (windingUp ? 260 : 0);
      if (score < best) { best = score; found = e; }
      return true;
    });
    return found;
  }

  private updateStall(delta: number, moving: boolean): void {
    if (moving || this.hover) {
      if (this.stall >= 900) this.floatText(this.player.x, this.player.y - 24, '甩开合围', '#b8fff4');
      this.stall = 0;
      return;
    }
    this.stall = Math.min(1400, this.stall + delta);
    if (this.stall < 900) return;
    if (!this.keys.B.isDown) {
      this.regenClock += delta;
      if (this.regenClock < 1600 || this.player.health >= this.player.maxHealth) return;
      this.regenClock = 0;
      const bandage = (this.enemies.getChildren() as PhantomEntity[]).find((enemy) => enemy.active && !enemy.isBoss && Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) <= 48);
      if (!bandage) {
        this.floatText(this.player.x, this.player.y - 24, '硬扛没贴上，包扎落空', '#ffb0b0');
        return;
      }
      const quietHeal = Math.max(4, Math.round(this.player.maxHealth * 0.04));
      this.player.health = Math.min(this.player.maxHealth, this.player.health + quietHeal);
      this.heat = Math.min(100, this.heat + 12);
      if (this.heat >= 100 && !this.overheated) { this.overheated = true; this.floatText(this.player.x, this.player.y - 40, '包扎过热', '#ffb0b0'); }
      this.floatText(bandage.x, bandage.y - 24, `贴身包扎 +${quietHeal}`, '#baffb0');
      return;
    }
    let caught = 0;
    for (const enemy of this.enemies.getChildren() as PhantomEntity[]) {
      if (!enemy.active || enemy.abilityActive || this.time.now < enemy.shoveUntil) continue;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (distance > 280 || distance < 36) continue;
      enemy.herdedUntil = this.time.now + 260;
      caught += 1;
      if (caught >= 4) break;
    }
    if (caught > 0 && this.stall < 900 + delta) this.floatText(this.player.x, this.player.y - 24, '按住诱敌', '#ffb0b0');
  }

  private holdLink(enemy: PhantomEntity): void {
    if (this.stall < 180 || !enemy.active || enemy.isBoss || this.time.now < enemy.shoveUntil || this.time.now < enemy.severedUntil || enemy.abilityActive) return;
    const neighbors = this.linkedNeighbors(enemy);
    if (neighbors.length >= 3) {
      const center = neighbors.reduce((sum, other) => sum.add(new Phaser.Math.Vector2(other.x, other.y)), new Phaser.Math.Vector2(enemy.x, enemy.y)).scale(1 / (neighbors.length + 1));
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, center.x, center.y) > 42) {
        if (!enemy.getData('knotHeld')) {
          enemy.setData('knotHeld', 1);
          this.floatText(center.x, center.y - 16, '团心空着', '#ffb0b0');
        }
        return;
      }
      if (enemy.getData('knotHeld')) {
        enemy.setData('knotHeld', 0);
        this.floatText(center.x, center.y - 16, '钻进团心 · 撑开', '#ffe28a');
      }
      const away = neighbors.reduce((sum, other) => sum.add(new Phaser.Math.Vector2(other.x - enemy.x, other.y - enemy.y)), new Phaser.Math.Vector2());
      if (away.lengthSq() > 1) enemy.setVelocity(-away.normalize().x * 90, -away.normalize().y * 90);
      return;
    }
    let nearest: PhantomEntity | undefined;
    let best = 90;
    for (const other of neighbors) {
      if (this.time.now < other.shoveUntil || this.linkedNeighbors(other).length >= 3) continue;
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y);
      if (distance < best) { best = distance; nearest = other; }
    }
    if (!nearest || best <= 68) return;
    const bridge = new Phaser.Math.Vector2(nearest.x - enemy.x, nearest.y - enemy.y);
    const toPlayer = new Phaser.Math.Vector2(this.player.x - enemy.x, this.player.y - enemy.y);
    const span = bridge.length();
    const along = span > 1 ? toPlayer.dot(bridge) / span : -1;
    const offLane = span > 1 ? toPlayer.clone().subtract(bridge.clone().scale(along / span)).length() : 999;
    if (along > 16 && along < span - 16 && offLane <= 28) {
      if (!enemy.getData('linkHeld')) {
        enemy.setData('linkHeld', 1);
        this.floatText(enemy.x, enemy.y - 16, '卡住合拢', '#ffe28a');
      }
      return;
    }
    if (enemy.getData('linkHeld')) {
      enemy.setData('linkHeld', 0);
      this.floatText(enemy.x, enemy.y - 16, '让开 · 链条合拢', '#ffb0b0');
    }
    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, nearest.x, nearest.y);
    enemy.setVelocity(Math.cos(angle) * 70, Math.sin(angle) * 70);
  }
  private enemyGap(): boolean {
    const enemies = (this.enemies.getChildren() as PhantomEntity[]).filter((enemy) => enemy.active && enemy.health > 0);
    if (enemies.length < 2) return true;
    let best = 0;
    let ax = enemies[0];
    let bx = enemies[0];
    for (const enemy of enemies) {
      for (const other of enemies) {
        if (other === enemy) continue;
        const span = Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y);
        if (span <= best) continue;
        const bridge = new Phaser.Math.Vector2(other.x - enemy.x, other.y - enemy.y);
        const toPlayer = new Phaser.Math.Vector2(this.player.x - enemy.x, this.player.y - enemy.y);
        const along = bridge.lengthSq() > 1 ? toPlayer.dot(bridge) / bridge.length() : -1;
        const off = bridge.lengthSq() > 1 ? toPlayer.clone().subtract(bridge.clone().scale(along / bridge.length())).length() : 999;
        if (along > 24 && along < span - 24 && off <= 42) { best = span; ax = enemy; bx = other; }
      }
    }
    if (best >= 180) {
      if (this.player.getData('spawnGap') !== 1) {
        this.player.setData('spawnGap', 1);
        this.floatText((ax.x + bx.x) / 2, (ax.y + bx.y) / 2 - 16, '穿行缺口 · 增援压制', '#ffe28a');
      }
      return true;
    }
    return false;
  }

  private spawnEnemy(x: number, y: number, variant: PhantomVariant, boss = false, elite = false): PhantomEntity { const e = new PhantomEntity(this, x, y, variant, boss, elite, this.stage); this.enemies.add(e); return e; }
  private spawnAtEdge(): void {
    if (this.enemies.countActive() >= 45) return;
    const edge = Math.min(this.player.x, GAME_WIDTH - this.player.x, this.player.y, GAME_HEIGHT - this.player.y);
    const left = this.player.x;
    const right = GAME_WIDTH - this.player.x;
    const top = this.player.y;
    const bottom = GAME_HEIGHT - this.player.y;
    const nearest = Math.min(left, right, top, bottom);
    let spot: [number, number];
    if (edge <= 150) {
      spot = nearest === left
        ? [-30, Phaser.Math.Clamp(this.player.y, 90, GAME_HEIGHT - 30)]
        : nearest === right
          ? [GAME_WIDTH + 30, Phaser.Math.Clamp(this.player.y, 90, GAME_HEIGHT - 30)]
          : nearest === top
            ? [Phaser.Math.Clamp(this.player.x, 30, GAME_WIDTH - 30), 54]
            : [Phaser.Math.Clamp(this.player.x, 30, GAME_WIDTH - 30), GAME_HEIGHT + 30];
      this.floatText(this.player.x, this.player.y - 24, '边缘截击位置', '#ffe28a');
    } else {
      const side = Phaser.Math.Between(0, 2);
      spot = side === 0
        ? [-30, Phaser.Math.Between(80, GAME_HEIGHT - 80)]
        : side === 1
          ? [GAME_WIDTH + 30, Phaser.Math.Between(80, GAME_HEIGHT - 80)]
          : [Phaser.Math.Between(60, GAME_WIDTH - 60), 40];
    }
    const pick = this.encounter.nextSpawn(Math.random);
    this.spawnEnemy(spot[0], spot[1], pick.variant, false, pick.elite);
  }

  private spawnLinked(x: number, y: number, variant: PhantomVariant, count: number, elite = false): void {
    for (let i = 0; i < count; i += 1) this.spawnEnemy(x + (i - (count - 1) / 2) * 62, y, variant, false, elite && i === Math.floor(count / 2));
  }

  private spawnWave(kind: WaveKind, label: string): void {
    this.floatText(GAME_WIDTH / 2, 150, label, '#ffe28a');
    if (kind === 'pincer') {
      this.spawnLinked(180, -20, 'rider', 3);
      this.spawnLinked(GAME_WIDTH - 180, -20, 'phantom', 3);
      return;
    }
    if (kind === 'dive-lane') {
      this.spawnLinked(GAME_WIDTH / 2, -24, 'phantom', 4);
      return;
    }
    if (kind === 'creeper-ring') {
      this.spawnEnemy(150, 70, 'creeper');
      this.spawnEnemy(GAME_WIDTH / 2, 150, 'creeper');
      this.spawnEnemy(GAME_WIDTH - 150, 70, 'creeper');
      return;
    }
    if (kind === 'wither-line') {
      this.spawnEnemy(120, 90, 'wither');
      this.spawnEnemy(GAME_WIDTH / 2, 150, 'wither', false, true);
      this.spawnEnemy(GAME_WIDTH - 120, 90, 'wither');
      return;
    }
    this.spawnEnemy(80, 120, 'warden');
    this.spawnEnemy(220, 70, 'warden');
    this.spawnEnemy(360, 130, 'warden');
    this.spawnEnemy(GAME_WIDTH - 360, 130, 'phantom');
    this.spawnEnemy(GAME_WIDTH - 220, 70, 'phantom');
    this.spawnEnemy(GAME_WIDTH - 80, 120, 'phantom');
  }


  private onBossPhase(enemy: PhantomEntity): void {
    this.floatText(enemy.x, enemy.y - 36, '狂暴 · 去抢核心', '#ffb0b0');
    this.cameras.main.shake(180, 0.006);
    this.dropPickup(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'focus', 1);
    if (enemy.variant === 'rider' || enemy.variant === 'warden') {
      this.spawnEnemy(90, 120, 'phantom');
      this.spawnEnemy(GAME_WIDTH - 90, 120, 'phantom');
    }
  }

  private spawnBoss(variant: PhantomVariant): PhantomEntity { this.bossGate = 0; this.boss = this.spawnEnemy(GAME_WIDTH / 2, 110, variant, true); this.encounter.onBossSpawned(); this.cameras.main.shake(220, 0.008); return this.boss; }
  private onShotHit(shotObj: any, enemyObj: any): void {
    const shot = shotObj as ProjectileEntity; const enemy = enemyObj as PhantomEntity;
    if (!shot.active || !enemy.active) return;
    const volley = shot.getData('volley');
    if (volley !== undefined && enemy.getData('lastVolley') === volley) { shot.destroy(); return; }
    enemy.setData('lastVolley', volley);
    let damage = Number(shot.getData('damage') ?? this.progression.state.attack);
    const pierce = Number(shot.getData('pierce') ?? 0);
    // Read the incoming direction while the projectile still owns its body.
    const flank = !this.hitsShield(enemy, shot);
    const keep = this.keys.C.isDown && pierce > 0;
    if (keep) { shot.setData('pierce', pierce - 1); shot.setData('damage', damage * 0.65); damage *= 0.8; }
    else shot.destroy();
    if (enemy.elite && !enemy.isBoss && this.time.now >= enemy.exposedUntil && this.guarded(enemy)) {
      this.floatText(enemy.x, enemy.y - 18, '护卫', '#d7c8ff');
      return;
    }
    if (enemy.elite && !enemy.isBoss && this.time.now >= enemy.exposedUntil) {
      if (!flank) { enemy.flankStacks = 0; this.floatText(enemy.x, enemy.y - 18, '盾面转回', '#d7ecff'); return; }
      enemy.flankStacks += 1;
      if (enemy.flankStacks < 3) { this.floatText(enemy.x, enemy.y - 18, `侧击 ${enemy.flankStacks}/3`, '#ffe28a'); return; }
      enemy.flankStacks = 0;
      enemy.exposedUntil = this.time.now + 1400;
      this.floatText(enemy.x, enemy.y - 18, '破绽', '#ffe28a');
      this.hitEnemy(enemy, damage * 1.8);
      return;
    }
    if (enemy.grudging && !flank) { this.floatText(enemy.x, enemy.y - 18, '记仇格挡', '#ff8d9a'); return; }
    this.lastFlank = flank;
    if (flank) this.floatText(enemy.x, enemy.y - 30, '侧击', '#fff1c7');
    if (enemy.charge > 0 && !enemy.isBoss) { this.overload(enemy, 0.5); return; }
    if (flank && this.keys.Z.isDown && !enemy.isBoss && this.linkedNeighbors(enemy).length === 1) this.pipeTail(enemy, damage * 0.7);
    const chainCore = !enemy.isBoss && this.linkedNeighbors(enemy).length >= 2;
    const exposedCore = chainCore && this.time.now < enemy.severedUntil;
    if (chainCore && !flank && !exposedCore) { this.floatText(enemy.x, enemy.y - 18, '链心', '#d7c8ff'); return; }
    if (exposedCore && !flank) damage *= 1.3;
    if (flank && !this.strafing && (enemy.isBoss || enemy.elite || chainCore)) damage *= 1.45;
    else if (flank && this.strafing) this.floatText(enemy.x, enemy.y - 18, '飞着没吃到侧伤', '#ffb0b0');
    if (!flank && !enemy.isBoss) {
      if (this.keys.Z.isDown) this.shoveLink(enemy);
      else if (this.linkedNeighbors(enemy).length > 0) { this.floatText(enemy.x, enemy.y - 18, '链挡住 · 按住Z震开', '#d7c8ff'); return; }
    }
    this.hitEnemy(enemy, damage);
  }



  private pipeTail(tail: PhantomEntity, damage: number): void {
    const core = this.linkedNeighbors(tail).find((enemy) => !enemy.elite && this.linkedNeighbors(enemy).length >= 2);
    if (!core?.active) return;
    this.conducting = true;
    this.hitEnemy(core, damage);
    this.conducting = false;
    this.floatText(core.x, core.y - 18, '尾击传导', '#fff1c7');
  }
  private shoveLink(enemy: PhantomEntity): void {
    const neighbors = this.linkedNeighbors(enemy);
    if (neighbors.length === 0) return;
    if (neighbors.some((other) => other.severedUntil > this.time.now)) return;
    for (const other of neighbors) {
      const away = Phaser.Math.Angle.Between(enemy.x, enemy.y, other.x, other.y);
      other.shoveUntil = this.time.now + 620;
      other.severedUntil = this.time.now + 1600;
      other.setVelocity(Math.cos(away) * 230, Math.sin(away) * 230);
    }
  }
  private guarded(enemy: PhantomEntity): boolean {
    const nearby = (this.enemies.getChildren() as PhantomEntity[]).filter((other) => other.active && !other.isBoss && Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y) <= 90);
    if (nearby.length < 3) return false;
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) > 78) return false;
    const around = nearby.filter((other) => {
      const toGuard = new Phaser.Math.Vector2(enemy.x - this.player.x, enemy.y - this.player.y);
      const toOther = new Phaser.Math.Vector2(other.x - this.player.x, other.y - this.player.y);
      return toOther.length() <= 110 && Math.abs(Phaser.Math.Angle.Wrap(toOther.angle() - toGuard.angle())) >= 0.7;
    });
    if (around.length < 2) return false;
    const seen = new Set<PhantomEntity>();
    for (const start of around) {
      if (seen.has(start)) continue;
      const group = [start];
      seen.add(start);
      for (let i = 0; i < group.length; i += 1) for (const other of around) {
        if (seen.has(other) || Phaser.Math.Distance.Between(group[i].x, group[i].y, other.x, other.y) > 90) continue;
        seen.add(other);
        group.push(other);
      }
      if (group.length >= 2) return true;
    }
    return false;
  }
  private hitsShield(enemy: PhantomEntity, shot: ProjectileEntity): boolean {
    const facing = enemy.flipX ? Math.PI : 0;
    const incoming = Math.atan2(shot.body?.velocity.y ?? 0, shot.body?.velocity.x ?? 1);
    return Math.abs(Phaser.Math.Angle.Wrap(incoming - facing - Math.PI)) < 0.9;
  }

  private hitEnemy(enemy: PhantomEntity, damage: number): void {
    if (!enemy.active) return;
    if (enemy.isBoss && enemy.enragedUntil > this.time.now && this.bossCore) damage *= 2;
    if (!enemy.isBoss && !this.conducting) {
      let packed = 0;
      for (const other of this.enemies.getChildren() as PhantomEntity[]) {
        if (!other.active || other === enemy || other.isBoss) continue;
        if (Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y) <= 90) packed += 1;
      }
      const inside = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) <= 72;
      if (packed > 0 && inside) {
        damage *= Math.max(0.45, 1 - packed * 0.18);
        if (!enemy.getData('packedCall')) {
          enemy.setData('packedCall', 1);
          this.floatText(enemy.x, enemy.y - 18, '挤进包围 · 伤害被分摊', '#ffb0b0');
        }
      } else if (packed > 0 && enemy.getData('packedCall')) {
        enemy.setData('packedCall', 0);
        this.floatText(enemy.x, enemy.y - 18, '拉开包围 · 伤害打实', '#ffe28a');
      }
    }
    const beforeRatio = enemy.health / enemy.maxHealth; this.burst(enemy.x, enemy.y, 0x9eeaff, 3); const killed = enemy.damage(damage); if (enemy.enteredPhaseTwo(beforeRatio)) this.onBossPhase(enemy); if (!killed) return;
    const x = enemy.x, y = enemy.y, wasBoss = enemy.isBoss, wasMarked = this.locked === enemy && this.lockMark >= 2000;
    // destroy() clears scene/body/data; capture the death rewards first.
    const wasGrudging = enemy.grudging;
    const wasExposed = enemy.exposedUntilStamp > this.time.now;
    const wasElite = enemy.elite;
    const baited = !wasBoss && enemy.whiffed;
    const rushed = !wasBoss && enemy.abilityActive && !enemy.whiffed;
    this.burst(x, y, wasBoss ? 0xffd467 : 0x83d968, wasBoss ? 25 : 7);
    if (!wasBoss && !this.conducting) this.passLife(enemy, x, y);
    enemy.destroy();
    if (this.locked === enemy) { this.locked = undefined; this.lockMark = 0; }
    this.kills++; this.encounter.onKill(wasBoss);
    if (wasGrudging) { this.spiteLife = 1500; this.spiteBoss = wasBoss; this.floatText(x, y - 34, '记仇可收 · [O]泄热 或 [L]变现', '#ffd0a8'); }
    if (!wasBoss && wasExposed) this.rewardBreach(x, y);
    if (wasMarked && !wasBoss) this.floatText(x, y - 20, '标记没引爆', '#ffb0b0');
    if (this.strafing) { this.chainLife = 1400; this.player.setData('chainX', x); this.player.setData('chainY', y); this.floatText(x, y - 18, '侧击可接 · 横穿落点再按 [U]/[I]', '#ffe28a'); }
    else if (this.combo > 0) { this.combo -= 1; this.floatText(x, y - 32, '直飞掉层', '#ffb0b0'); if (this.combo === 0) this.comboClock = 0; }
    const stance = this.strafing ? 'strafe' as const : this.player.body && (this.player.body.velocity.lengthSq() > 400) ? 'rush' as const : 'still' as const;
    const preview = this.economy.preview(wasBoss ? 'boss' : wasElite ? 'elite' : 'normal');
    const lootXp = baited ? preview.xp * 2 : preview.xp;
    const lootGems = rushed ? Math.ceil(preview.gems / 2) : baited ? preview.gems * 2 : preview.gems;
    const flight = this.player.body?.velocity;
    const flying = !!flight && flight.lengthSq() > 400;
    const through = flying ? new Phaser.Math.Vector2(x - this.player.x, y - this.player.y) : new Phaser.Math.Vector2();
    const carried = flying && through.length() > 18 && through.length() < 150 && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(flight.y, flight.x) - through.angle())) < 0.45;
    const lootX = carried ? Phaser.Math.Clamp(x + flight.x * 0.18, 36, GAME_WIDTH - 36) : x;
    const lootY = carried ? Phaser.Math.Clamp(y + flight.y * 0.18, 84, GAME_HEIGHT - 36) : y;
    this.dropPickup(lootX, lootY, 'loot', 1, { xp: lootXp, gems: lootGems, heal: preview.heal, stance });
    this.floatText(lootX, lootY - 30, carried ? '穿过 · 掉落甩出' : '没穿过 · 掉落留在原地', carried ? '#ffe28a' : '#ffb0b0');
    if (baited) this.floatText(x, y - 46, '扑空掉落翻倍', '#ffe28a');
    else if (rushed) this.floatText(x, y - 46, '硬拆少掉', '#ffb0b0');
    if (wasBoss || wasElite) this.dropPickup(x + 18, y, 'relic', 1);
    if (wasBoss) { this.boss = undefined; const cleared = this.encounter.onBossDefeated(); this.stage = cleared.chapterIndex; this.finalBossDefeated = cleared.finished; if (cleared.finished) this.floatText(480, 200, '末地核心已净化 · 按 R 撤离并结算', '#a1ff99'); else { const banked = this.remedy > 0 && this.remedyLife <= 0; const centered = Phaser.Math.Distance.Between(this.player.x, this.player.y, GAME_WIDTH / 2, GAME_HEIGHT / 2) <= 130; if (banked && centered) { this.remedyLife = 1800; this.floatText(this.player.x, this.player.y - 24, `保险可兑 +${this.remedy} · 留在中央按 H`, '#ffe28a'); } else if (banked) { const gems = Math.max(2, Math.round(this.remedy / 8)); this.remedy = 0; this.economy.gems += gems; this.floatText(this.player.x, this.player.y - 24, `没留中央 · 保险折现 +${gems} ◆`, '#ffb0b0'); } else this.floatText(480, 200, '章节完成 · 没留保险', '#ffb0b0'); } }
    if (this.economy.pendingUpgrades && !this.paused) this.showUpgrade();
  }

  private linkedNeighbors(source: PhantomEntity, x = source.x, y = source.y): PhantomEntity[] {
    return (this.enemies.getChildren() as PhantomEntity[]).filter((other) => other.active && other !== source && !other.isBoss && Phaser.Math.Distance.Between(x, y, other.x, other.y) <= 90);
  }


  private unfeedBoss(x: number, y: number): void {
    const boss = (this.enemies.getChildren() as PhantomEntity[]).find((enemy) => enemy.active && enemy.isBoss && Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) <= 120);
    if (!boss || boss.enragedUntil > this.time.now) return;
    boss.enrage(3200);
    const feedLine = new Phaser.Math.Vector2(boss.x - x, boss.y - y);
    const toPlayer = new Phaser.Math.Vector2(this.player.x - x, this.player.y - y);
    const span = feedLine.length();
    const along = span > 1 ? toPlayer.dot(feedLine) / span : -1;
    const off = span > 1 ? toPlayer.clone().subtract(feedLine.clone().scale(along / span)).length() : 999;
    const severed = along > 12 && along < span - 12 && off <= 38;
    if (severed) {
      this.dropPickup(boss.x, boss.y + 28, 'core', 1);
      this.floatText(boss.x, boss.y - 30, '卡死供线 · 核心落地', '#ff7a8a');
    } else {
      this.floatText(boss.x, boss.y - 30, '没卡在供线上 · 核心没落', '#ffb0b0');
    }
  }
  private passLife(source: PhantomEntity, x: number, y: number): void {
    const neighbors = this.linkedNeighbors(source, x, y);
    if (neighbors.length === 0) return;
    const cores = this.lastFlank ? neighbors.filter((enemy) => this.linkedNeighbors(enemy).length >= 2) : [];
    if (cores.length > 0 && this.keys.Z.isDown) {
      const gained = Math.max(8, Math.round(source.maxHealth * 0.35));
      this.player.health = Math.min(this.player.maxHealth, this.player.health + gained);
      this.heat = Math.min(100, this.heat + 22);
      if (this.heat >= 100 && !this.overheated) { this.overheated = true; this.floatText(this.player.x, this.player.y - 40, '吸血过热', '#ffb0b0'); }
      for (const core of cores) core.coverSpite = true;
      this.floatText(this.player.x, this.player.y - 24, `吸血 +${gained} · 链还在`, '#d7c8ff');
      return;
    }
    if (cores.length === 0) {
      for (const other of neighbors) {
        const away = Phaser.Math.Angle.Between(x, y, other.x, other.y);
        other.shoveUntil = this.time.now + 450;
        other.severedUntil = this.time.now + (this.lastFlank ? 4200 : 2600);
        other.setVelocity(Math.cos(away) * 210, Math.sin(away) * 210);
      }
      this.floatText(x, y - 16, '剪断', '#ffe28a');
      this.unfeedBoss(x, y);
      return;
    }
    if (!this.keys.Z.isDown) {
      for (const other of neighbors) {
        const away = Phaser.Math.Angle.Between(x, y, other.x, other.y);
        other.shoveUntil = this.time.now + 450;
        other.severedUntil = this.time.now + (this.lastFlank ? 4200 : 2600);
        other.setVelocity(Math.cos(away) * 210, Math.sin(away) * 210);
      }
      this.floatText(x, y - 16, '没按住，链被剪断', '#ffe28a');
      this.unfeedBoss(x, y);
      return;
    }
    const nearest = cores.sort((a, b) => Phaser.Math.Distance.Between(x, y, a.x, a.y) - Phaser.Math.Distance.Between(x, y, b.x, b.y))[0];
    const standingOn = Phaser.Math.Distance.Between(this.player.x, this.player.y, nearest.x, nearest.y) <= 42;
    if (!standingOn) {
      for (const other of neighbors) {
        const away = Phaser.Math.Angle.Between(x, y, other.x, other.y);
        other.shoveUntil = this.time.now + 450;
        other.severedUntil = this.time.now + (this.lastFlank ? 4200 : 2600);
        other.setVelocity(Math.cos(away) * 210, Math.sin(away) * 210);
      }
      this.floatText(nearest.x, nearest.y - 16, '没站上去，续命落空', '#ffb0b0');
      this.unfeedBoss(x, y);
      return;
    }
    const fed = Math.round(source.maxHealth * 0.5);
    nearest.absorb(fed);
    this.floatText(nearest.x, nearest.y - 16, `站上续命 +${fed}`, '#d7c8ff');
  }
  private suckLoot(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i += 1) {
      const block = this.add.rectangle(x + (i - count / 2) * 7, y, 6, 6, color).setDepth(8);
      this.tweens.add({
        targets: block, x: this.player.x, y: this.player.y, duration: 280 + i * 30, ease: 'Quad.easeIn',
        onComplete: () => block.destroy(),
      });
    }
  }
  private burst(x: number, y: number, color: number, count: number): void { for (let i = 0; i < count; i++) { const block = this.add.rectangle(x, y, 4 + Math.random() * 4, 4 + Math.random() * 4, color).setDepth(8); this.tweens.add({ targets: block, x: x + Phaser.Math.Between(-34, 34), y: y + Phaser.Math.Between(-34, 34), alpha: 0, duration: 280, onComplete: () => block.destroy() }); } }
  private floatText(x: number, y: number, text: string, color: string): void { const label = this.add.text(x, y, text, { fontSize: '18px', color }).setOrigin(0.5).setDepth(9); this.tweens.add({ targets: label, y: y - 35, alpha: 0, duration: 1200, onComplete: () => label.destroy() }); }
  private detonateNow(): void {
    const enemy = this.locked;
    if (!enemy?.active || enemy.health <= 0 || enemy.isBoss || this.lockMark < 2000) {
      this.floatText(this.player.x, this.player.y - 24, '标记还没满', '#ffb0b0');
      return;
    }
    const flank = this.lastFlank;
    const x = enemy.x;
    const y = enemy.y;
    this.lockMark = 0;
    this.hitEnemy(enemy, this.progression.state.attack * 3);
    this.detonateMark(x, y, flank);
  }

  private detonateMark(x: number, y: number, flank = false): void {
    this.floatText(x, y - 20, '锁定引爆', '#fff1c7');
    const victims = [...this.enemies.getChildren()] as PhantomEntity[];
    let survivor: PhantomEntity | undefined;
    const sparked: PhantomEntity[] = [];
    let slipped = 0;
    for (const enemy of victims) {
      if (!enemy.active || enemy.isBoss) continue;
      if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) > (flank ? 230 : 150)) continue;
      const velocity = enemy.body?.velocity;
      const rushing = !!velocity && velocity.lengthSq() > 400;
      const into = rushing && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(velocity.y, velocity.x) - Phaser.Math.Angle.Between(enemy.x, enemy.y, x, y))) < 0.7;
      if (!into) { slipped += 1; continue; }
      const healthBefore = enemy.health;
      this.hitEnemy(enemy, this.progression.state.attack * 4);
      sparked.push(enemy);
      if (enemy.active && enemy.health > 0 && enemy.health < healthBefore && !survivor) survivor = enemy;
    }
    if (slipped > 0) this.floatText(x, y - 52, sparked.length > 0 ? `冲进爆点 x${sparked.length}` : '没人冲进来 · 爆点落空', sparked.length > 0 ? '#ffe28a' : '#ffb0b0');
    const jumps = this.conduct(sparked, this.progression.state.attack * 2.2, 2);
    if (jumps > 0) this.floatText(x, y - 38, `传导 x${jumps}`, '#d7c8ff');
    if (survivor && this.markTransfers < 2 && this.keys.X.isDown) {
      this.markTransfers += 1;
      this.locked = survivor;
      this.lockMark = 2000;
      this.floatText(survivor.x, survivor.y - 18, `按住转移 ${this.markTransfers}/2`, '#ffd467');
    } else {
      this.markTransfers = 0;
      if (survivor) this.floatText(survivor.x, survivor.y - 18, '标记没转移', '#ffb0b0');
    }
    const selfRadius = (this.hover ? 210 : 150) + (flank ? 0 : 70);
    if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) <= selfRadius) {
      const burn = Math.max(8, Math.round(this.progression.state.attack * (this.hover ? 0.55 : 0.35) * (flank ? 1 : 1.35)));
      this.hurtPlayer(burn);
      this.floatText(this.player.x, this.player.y - 24, `引爆自伤 -${burn}`, '#ffb0b0');
    }
  }


  private conduct(seeds: PhantomEntity[], damage: number, hops: number): number {
    const seen = new Set(seeds);
    let frontier = seeds.filter((enemy) => enemy.active);
    let jumps = 0;
    let blocked = 0;
    this.conducting = true;
    for (let hop = 0; hop < hops && frontier.length > 0; hop += 1) {
      const next: PhantomEntity[] = [];
      for (const current of frontier) for (const other of this.enemies.getChildren() as PhantomEntity[]) {
        if (!other.active || other.isBoss || seen.has(other)) continue;
        if (Phaser.Math.Distance.Between(current.x, current.y, other.x, other.y) > 90) continue;
        const toOther = new Phaser.Math.Vector2(other.x - current.x, other.y - current.y);
        const toPlayer = new Phaser.Math.Vector2(this.player.x - current.x, this.player.y - current.y);
        const span = toOther.length();
        const along = span > 1 ? toPlayer.dot(toOther) / span : -1;
        const offLane = span > 1 ? toPlayer.clone().subtract(toOther.clone().scale(along / span)).length() : 999;
        if (!(along > 14 && along < span - 14 && offLane <= 30)) { blocked += 1; continue; }
        seen.add(other);
        this.hitEnemy(other, damage * (hop === 0 ? 1 : 0.65));
        jumps += 1;
        if (other.active) next.push(other);
      }
      frontier = next;
    }
    this.conducting = false;
    if (jumps === 0 && blocked > 0) this.floatText(this.player.x, this.player.y - 40, '没站在链上，传导断了', '#ffb0b0');
    return jumps;
  }

  private reelChain(): void {
    const anchor = this.locked;
    if (!anchor?.active || anchor.health <= 0 || anchor.isBoss) {
      this.floatText(this.player.x, this.player.y - 24, '先锁定普通怪', '#d7c8ff');
      return;
    }
    if (this.reelClock > 0) { this.floatText(anchor.x, anchor.y - 24, '链已绷紧', '#d7c8ff'); return; }
    if (this.heat < 18) { this.floatText(this.player.x, this.player.y - 24, '聚链需要热量', '#ffb0b0'); return; }
    const flight = this.player.body?.velocity;
    const moving = !!flight && flight.lengthSq() > 400;
    let pulled = 0;
    let shoved = 0;
    let missed = 0;
    for (const other of this.enemies.getChildren() as PhantomEntity[]) {
      if (!other.active || other === anchor || other.isBoss) continue;
      const bridge = new Phaser.Math.Vector2(other.x - anchor.x, other.y - anchor.y);
      const span = bridge.length();
      if (span > 240 || span <= 62) continue;
      const toPlayer = new Phaser.Math.Vector2(this.player.x - anchor.x, this.player.y - anchor.y);
      const along = toPlayer.dot(bridge) / span;
      const offLane = toPlayer.clone().subtract(bridge.clone().scale(along / span)).length();
      const planted = !moving && along > 24 && along < span - 24 && offLane <= 34;
      const angle = Phaser.Math.Angle.Between(other.x, other.y, anchor.x, anchor.y);
      other.shoveUntil = this.time.now + 260;
      if (planted) {
        other.severedUntil = 0;
        other.setVelocity(Math.cos(angle) * 280, Math.sin(angle) * 280);
        pulled += 1;
      } else {
        other.setVelocity(-Math.cos(angle) * 180, -Math.sin(angle) * 180);
        if (moving) shoved += 1;
        else missed += 1;
      }
      if (pulled + shoved >= 3) break;
    }
    if (pulled === 0 && shoved === 0 && missed === 0) { this.floatText(anchor.x, anchor.y - 24, '附近没有散怪', '#d7c8ff'); return; }
    if (pulled === 0) {
      this.floatText(anchor.x, anchor.y - 24, moving ? '飞着收 · 散怪被推开' : '没停在中间 · 链没收住', '#ffb0b0');
      return;
    }
    const boss = (this.enemies.getChildren() as PhantomEntity[]).find((enemy) => enemy.active && enemy.isBoss && Phaser.Math.Distance.Between(anchor.x, anchor.y, enemy.x, enemy.y) <= 240);
    if (boss) {
      const bossAngle = Phaser.Math.Angle.Between(boss.x, boss.y, anchor.x, anchor.y);
      boss.shoveUntil = this.time.now + 360;
      boss.setVelocity(Math.cos(bossAngle) * 180, Math.sin(bossAngle) * 180);
      this.floatText(boss.x, boss.y - 20, '拽离供能', '#ffb0b0');
    }
    this.reelClock = 900;
    this.floatText(anchor.x, anchor.y - 24, `聚链 x${pulled} · 剪断否则齐射`, '#d7c8ff');
  }
  private updateReel(delta: number): void {
    if (this.reelClock <= 0) return;
    const anchor = this.locked;
    const linked = anchor?.active ? this.linkedNeighbors(anchor) : [];
    const center = linked.reduce((sum, enemy) => sum.add(new Phaser.Math.Vector2(enemy.x, enemy.y)), new Phaser.Math.Vector2(anchor?.x ?? this.player.x, anchor?.y ?? this.player.y)).scale(1 / Math.max(1, linked.length + (anchor?.active ? 1 : 0)));
    const inside = Phaser.Math.Distance.Between(this.player.x, this.player.y, center.x, center.y) <= 70;
    this.reelClock -= delta * (inside ? 1 : 2.4);
    if (inside && this.player.getData('reelHeld') !== 1) { this.player.setData('reelHeld', 1); this.floatText(center.x, center.y - 16, '留在链团里 · 继续绷紧', '#d7c8ff'); }
    else if (!inside && this.player.getData('reelHeld') !== 2) { this.player.setData('reelHeld', 2); this.floatText(this.player.x, this.player.y - 16, '离开链团 · 绷紧松开', '#ffb0b0'); }
    this.heat = Math.min(100, this.heat + delta * (inside ? 0.04 : 0.012));
    if (this.heat >= 100 && !this.overheated) { this.overheated = true; this.floatText(this.player.x, this.player.y - 24, '聚链过热', '#ffb0b0'); }
    if (!anchor?.active || anchor.health <= 0 || anchor.isBoss || this.time.now < anchor.severedUntil) {
      this.reelClock = 0;
      this.player.setData('reelHeld', 0);
      if (anchor?.active) this.floatText(anchor.x, anchor.y - 24, '聚链松开', '#ffe28a');
      return;
    }
    if (this.reelClock > 0) return;
    const mobs = (this.enemies.getChildren() as PhantomEntity[]).filter((enemy) => enemy.active && !enemy.isBoss && this.time.now >= enemy.severedUntil);
    const group = [anchor];
    for (let i = 0; i < group.length; i += 1) for (const other of mobs) {
      if (group.includes(other)) continue;
      if (Phaser.Math.Distance.Between(group[i].x, group[i].y, other.x, other.y) > 90) continue;
      group.push(other);
    }
    if (group.length < 3) { this.floatText(anchor.x, anchor.y - 24, '链没绷住', '#ffe28a'); return; }
    const velocity = this.player.body?.velocity;
    const moving = !!velocity && velocity.lengthSq() > 400;
    const slip = moving ? Math.atan2(velocity.y, velocity.x) + Math.PI / 2 : Phaser.Math.Angle.Between(anchor.x, anchor.y, this.player.x, this.player.y);
    this.chainAim.set(anchor, slip);
    this.chainClock = 420;
    this.floatText(anchor.x, anchor.y - 24, moving ? '齐射顺着你的横移' : '停住 · 齐射直锁', moving ? '#ffe28a' : '#ffb0b0');
  }
  private useHook(): void {
    const enemy = this.locked;
    if (!enemy?.active || enemy.health <= 0 || this.economy.hooks <= 0) {
      if (this.economy.hooks <= 0) this.floatText(this.player.x, this.player.y - 24, '没有钩爪', '#d7ecff');
      return;
    }
    this.economy.hooks -= 1;
    if (this.comboBank > 0) {
      this.combo = this.comboBank; this.comboBank = 0; this.comboGrace = 0; this.comboClock = 2500;
      this.floatText(this.player.x, this.player.y - 42, `追回 x${this.combo}`, '#ffe28a');
      return;
    }
    const velocity = this.player.body?.velocity;
    const moving = !!velocity && velocity.lengthSq() > 400;
    if (this.keys.SHIFT.isDown && moving && !enemy.isBoss) {
      const aim = Math.atan2(velocity.y, velocity.x);
      enemy.setPosition(
        Phaser.Math.Clamp(this.player.x + Math.cos(aim) * 210, 48, GAME_WIDTH - 48),
        Phaser.Math.Clamp(this.player.y + Math.sin(aim) * 210, 90, GAME_HEIGHT - 48),
      );
      enemy.shoveUntil = this.time.now + 500;
      enemy.herdedUntil = this.time.now + 500;
      enemy.setVelocity(Math.cos(aim) * 260, Math.sin(aim) * 260);
      this.floatText(enemy.x, enemy.y - 24, '甩进弹幕', '#d7ecff');
      return;
    }
    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
    const pull = enemy.isBoss ? 140 : 54;
    enemy.setPosition(
      Phaser.Math.Clamp(this.player.x + Math.cos(angle) * pull, 48, GAME_WIDTH - 48),
      Phaser.Math.Clamp(this.player.y + Math.sin(angle) * pull, 90, GAME_HEIGHT - 48),
    );
    if (enemy.isBoss) {
      enemy.cancelCast(1200);
      this.floatText(enemy.x, enemy.y - 28, '拽偏', '#d7ecff');
      return;
    }
    enemy.exposedUntil = this.time.now + 1600;
    enemy.grudgeUntil = this.time.now + 1600;
    enemy.setFlipX(Math.cos(angle) > 0);
    this.lockMark = 2000;
    let dragged = 0;
    let skipped = 0;
    const flight = moving ? new Phaser.Math.Vector2(velocity.x, velocity.y).normalize() : new Phaser.Math.Vector2();
    for (const other of this.enemies.getChildren() as PhantomEntity[]) {
      if (!other.active || other === enemy || other.isBoss) continue;
      if (Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y) > 150) continue;
      const between = new Phaser.Math.Vector2(other.x - this.player.x, other.y - this.player.y);
      const ahead = moving ? between.dot(flight) : -1;
      const offLane = moving ? between.clone().subtract(flight.clone().scale(ahead)).length() : 999;
      if (!(moving && ahead > 20 && ahead < 180 && offLane <= 36)) { skipped += 1; continue; }
      const spread = (dragged - 1) * 0.7;
      other.setPosition(
        Phaser.Math.Clamp(enemy.x + Math.cos(angle + Math.PI / 2 + spread) * 62, 48, GAME_WIDTH - 48),
        Phaser.Math.Clamp(enemy.y + Math.sin(angle + Math.PI / 2 + spread) * 62, 90, GAME_HEIGHT - 48),
      );
      other.shoveUntil = this.time.now + 300;
      dragged += 1;
      if (dragged >= 2) break;
    }
    this.floatText(enemy.x, enemy.y - 24, dragged > 0 ? `飞过带入 x${dragged}` : skipped > 0 ? '没飞过 · 附近没带入' : '钩中 · 记仇', dragged > 0 ? '#ffe28a' : '#ff8d9a');
  }

  private updateGrudge(delta: number): void {
    const enemy = this.locked;
    if (!enemy?.active || enemy.health <= 0) { this.lockAge = 0; return; }
    const enemyVelocity = enemy.body?.velocity;
    const flight = this.player.body?.velocity;
    const enemyMoving = !!enemyVelocity && enemyVelocity.lengthSq() > 400;
    const moving = !!flight && flight.lengthSq() > 400;
    const toEnemy = new Phaser.Math.Vector2(enemy.x - this.player.x, enemy.y - this.player.y);
    const crossing = enemyMoving && moving && Math.abs(toEnemy.dot(new Phaser.Math.Vector2(-enemyVelocity.y, enemyVelocity.x).normalize())) <= 28;
    const provoking = this.strafing && this.keys.Q.isDown && crossing;
    this.lockAge = Phaser.Math.Clamp(this.lockAge + (provoking ? delta : -delta * 1.4), 0, 900);
    const state = provoking ? 1 : this.keys.Q.isDown ? 2 : 0;
    if (this.player.getData('grudgeLane') !== state) {
      this.player.setData('grudgeLane', state);
      if (state > 0) this.floatText(enemy.x, enemy.y - 18, provoking ? '横切航线 · 记仇上涨' : '没切中航线 · 记仇回落', provoking ? '#ff8d9a' : '#ffb0b0');
    }
    if (this.lockAge < 700 || enemy.grudging) return;
    enemy.grudgeUntil = this.time.now + 2200;
    this.floatText(enemy.x, enemy.y - 30, '记仇', '#ff8d9a');
  }



  private overload(enemy: PhantomEntity, power: number): void {
    const neighbors = this.linkedNeighbors(enemy);
    const group = [enemy];
    let blocked = 0;
    for (const other of neighbors) {
      const bridge = new Phaser.Math.Vector2(other.x - enemy.x, other.y - enemy.y);
      const toPlayer = new Phaser.Math.Vector2(this.player.x - enemy.x, this.player.y - enemy.y);
      const span = bridge.length();
      const along = span > 1 ? toPlayer.dot(bridge) / span : -1;
      const offLane = span > 1 ? toPlayer.clone().subtract(bridge.clone().scale(along / span)).length() : 999;
      if (!(along > 16 && along < span - 16 && offLane <= 32)) { blocked += 1; continue; }
      group.push(other);
    }
    for (const other of group) {
      other.charge = 0;
      const away = Phaser.Math.Angle.Between(this.player.x, this.player.y, other.x, other.y);
      other.shoveUntil = this.time.now + 500;
      other.severedUntil = this.time.now + 1800;
      other.setVelocity(Math.cos(away) * 250, Math.sin(away) * 250);
      this.hitEnemy(other, this.progression.state.attack * 3 * power);
    }
    if (group.length > 1) this.floatText(enemy.x, enemy.y - 42, `站上过载 x${group.length - 1}`, '#ffe28a');
    else if (blocked > 0) this.floatText(enemy.x, enemy.y - 42, '没站在连线上 · 过载没传开', '#ffb0b0');
    if (Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) <= 150) {
      const burn = Math.max(10, Math.round(this.progression.state.attack * 0.45));
      this.hurtPlayer(burn);
      this.floatText(this.player.x, this.player.y - 24, `过载波及 -${burn}`, '#ffb0b0');
    }
    this.floatText(enemy.x, enemy.y - 28, power < 1 ? '提前点爆' : '锁链过载', '#ffb0b0');
  }


  private reapWhiff(delta: number): void {
    if (this.whiffLife <= 0) return;
    if (this.keys.T.isDown) {
      const xp = this.whiffXp;
      const gems = this.whiffGems;
      const stance = this.whiffStance;
      this.whiffLife = 0;
      this.economy.gems += gems;
      this.progression.addExperience(xp, stance);
      this.player.maxHealth = this.progression.state.maxHealth;
      this.floatText(this.player.x, this.player.y - 24, `补刀收割 +${gems} ◆`, '#ffe28a');
      if (this.economy.pendingUpgrades && !this.paused) this.showUpgrade();
      return;
    }
    const flight = this.player.body?.velocity;
    const still = !flight || flight.lengthSq() <= 400;
    let behind = false;
    for (const enemy of this.enemies.getChildren() as PhantomEntity[]) {
      if (!enemy.active || !enemy.whiffed) continue;
      const facing = enemy.flipX ? Math.PI : 0;
      const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      if (Math.abs(Phaser.Math.Angle.Wrap(angle - facing - Math.PI)) <= 0.8 && Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) <= 110) behind = true;
    }
    const reaping = still && behind;
    if (reaping && this.player.getData('whiffStay') !== 1) { this.player.setData('whiffStay', 1); this.floatText(this.player.x, this.player.y - 18, '停在扑空背后 · 收割还在', '#ffe28a'); }
    else if (!reaping && this.player.getData('whiffStay') !== 2) { this.player.setData('whiffStay', 2); this.floatText(this.player.x, this.player.y - 18, '没停在背后 · 收割在丢', '#ffb0b0'); }
    this.whiffLife -= delta * (reaping ? 0.3 : 2.25);
    if (this.whiffLife > 0) return;
    this.player.setData('whiffStay', 0);
    this.floatText(this.player.x, this.player.y - 24, '扑空没收住', '#ffb0b0');
  }

  private claimSpite(kind: 'vent' | 'cash'): void {
    if (this.spiteLife <= 0) return;
    const boss = this.spiteBoss;
    this.spiteLife = 0;
    if (kind === 'cash') {
      const gems = boss ? 12 : 5;
      this.economy.gems += gems;
      this.floatText(this.player.x, this.player.y - 24, `记仇变现 +${gems} ◆`, '#7dff63');
      return;
    }
    const cooled = boss ? 28 : 16;
    this.heat = Math.max(0, this.heat - cooled);
    if (this.heat <= 25) this.overheated = false;
    this.floatText(this.player.x, this.player.y - 24, `泄愤 -${cooled} 热`, '#ffd0a8');
  }

  private expireSpite(delta: number): void {
    if (this.spiteLife <= 0) return;
    const flight = this.player.body?.velocity;
    const moving = !!flight && flight.lengthSq() > 400;
    let nearest: PhantomEntity | undefined;
    let best = Number.POSITIVE_INFINITY;
    for (const enemy of this.enemies.getChildren() as PhantomEntity[]) {
      if (!enemy.active || enemy.health <= 0) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist < best) { best = dist; nearest = enemy; }
    }
    const toNear = nearest ? new Phaser.Math.Vector2(nearest.x - this.player.x, nearest.y - this.player.y) : new Phaser.Math.Vector2();
    const pressing = moving && nearest && best > 36 && best < 240 && flight.dot(toNear) > flight.length() * toNear.length() * 0.45;
    if (pressing && this.player.getData('spitePress') !== 1) { this.player.setData('spitePress', 1); this.floatText(this.player.x, this.player.y - 18, '迎着敌群冲 · 记仇在燃', '#ffd0a8'); }
    else if (!pressing && this.player.getData('spitePress') !== 2) { this.player.setData('spitePress', 2); this.floatText(this.player.x, this.player.y - 18, '没迎着冲 · 怒气在散', '#ffb0b0'); }
    this.spiteLife -= delta * (pressing ? 0.35 : 2.2);
    if (this.spiteLife > 0) return;
    this.player.setData('spitePress', 0);
    this.floatText(this.player.x, this.player.y - 24, '怒气散了', '#ffb0b0');
  }

  private claimChain(kind: 'stack' | 'cash'): void {
    if (this.chainLife <= 0) return;
    this.chainLife = 0;
    if (kind === 'cash') {
      const gems = 4;
      this.economy.gems += gems;
      this.floatText(this.player.x, this.player.y - 24, `连击变现 +${gems} ◆`, '#7dff63');
      return;
    }
    this.combo = Math.min(12, this.combo + 1);
    this.comboClock = 2500;
    if (this.combo >= 3) {
      this.heat = Math.min(100, this.heat + 6);
      if (this.heat >= 100 && !this.overheated) { this.overheated = true; this.floatText(this.player.x, this.player.y - 40, '连击过热', '#ffb0b0'); }
    }
    this.floatText(this.player.x, this.player.y - 24, `连击叠上 x${this.combo}`, '#ffe28a');
  }

  private expireChain(delta: number): void {
    if (this.chainLife <= 0) return;
    const flight = this.player.body?.velocity;
    const moving = !!flight && flight.lengthSq() > 400;
    const chain = new Phaser.Math.Vector2(Number(this.player.getData('chainX') ?? this.player.x) - this.player.x, Number(this.player.getData('chainY') ?? this.player.y) - this.player.y);
    const across = moving && chain.length() > 24 && chain.length() < 180 && Math.abs(flight.dot(new Phaser.Math.Vector2(-chain.y, chain.x))) > flight.length() * chain.length() * 0.65;
    if (across && this.player.getData('chainCut') !== 1) { this.player.setData('chainCut', 1); this.floatText(Number(this.player.getData('chainX')), Number(this.player.getData('chainY')) - 16, '横穿落点 · 侧击还在', '#ffe28a'); }
    else if (!across && this.player.getData('chainCut') !== 2) { this.player.setData('chainCut', 2); this.floatText(this.player.x, this.player.y - 16, '没横穿落点 · 侧击在断', '#ffb0b0'); }
    this.chainLife -= delta * (across ? 0.35 : 2.2);
    if (this.chainLife > 0) return;
    this.player.setData('chainCut', 0);
    this.floatText(this.player.x, this.player.y - 24, '侧击没接上', '#ffb0b0');
  }

  private rewardBreach(x: number, y: number): void {
    this.breachX = x;
    this.breachY = y;
    this.breachLife = 1600;
    this.floatText(x, y - 18, '突破 · [J]扩散 或 [K]搜刮', '#fff1c7');
  }

  private claimBreach(kind: 'spread' | 'loot'): void {
    if (this.breachLife <= 0) return;
    const x = this.breachX;
    const y = this.breachY;
    this.breachLife = 0;
    if (kind === 'loot') {
      const gems = 6;
      this.economy.gems += gems;
      this.floatText(x, y - 18, `搜刮 +${gems} ◆`, '#7dff63');
      return;
    }
    let opened = 0;
    for (const other of this.enemies.getChildren() as PhantomEntity[]) {
      if (!other.active || other.isBoss || Phaser.Math.Distance.Between(x, y, other.x, other.y) > 140) continue;
      other.exposedUntil = Math.max(other.exposedUntil, this.time.now + 1800);
      other.severedUntil = Math.max(other.severedUntil, this.time.now + 1800);
      opened += 1;
    }
    this.floatText(x, y - 18, opened > 0 ? `破绽扩散 x${opened}` : '周围没有人', opened > 0 ? '#fff1c7' : '#ffb0b0');
  }

  private expireBreach(delta: number): void {
    if (this.breachLife <= 0) return;
    const flight = this.player.body?.velocity;
    const moving = !!flight && flight.lengthSq() > 400;
    const away = new Phaser.Math.Vector2(this.player.x - this.breachX, this.player.y - this.breachY);
    const outward = moving && away.length() > 36 && away.length() < 220 && flight.dot(away) > flight.length() * away.length() * 0.45;
    if (outward && this.player.getData('breachOut') !== 1) { this.player.setData('breachOut', 1); this.floatText(this.breachX, this.breachY - 16, '向外冲开 · 突破还在', '#fff1c7'); }
    else if (!outward && this.player.getData('breachOut') !== 2) { this.player.setData('breachOut', 2); this.floatText(this.player.x, this.player.y - 16, '没向外冲 · 突破在散', '#ffb0b0'); }
    this.breachLife -= delta * (outward ? 0.4 : 2.15);
    if (this.breachLife > 0) return;
    this.player.setData('breachOut', 0);
    this.floatText(this.breachX, this.breachY - 18, '突破散了', '#ffb0b0');
  }
  private contestPhase(_delta: number): void {
    const enemy = this.boss;
    if (!enemy?.active || enemy.phaseGate <= 0) return;
    const close = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) <= 110;
    if (this.time.now < enemy.phaseGate) {
      if (close && !enemy.getData('phasePressed')) {
        enemy.setData('phasePressed', 1);
        this.floatText(enemy.x, enemy.y - 34, '压住转阶段', '#fff1c7');
      }
      return;
    }
    enemy.phaseGate = 0;
    enemy.setData('phasePressed', 0);
    if (close) {
      enemy.phase = 2;
      this.onBossPhase(enemy);
      return;
    }
    enemy.health = Math.max(enemy.health, Math.round(enemy.maxHealth * 0.62));
    this.floatText(enemy.x, enemy.y - 30, '拉开 · 血线回补', '#ffb0b0');
  }

  private pressReads(delta: number): void {
    for (const enemy of this.enemies.getChildren() as PhantomEntity[]) {
      if (!enemy.active || !enemy.isBoss) continue;
      const winding = enemy.abilityActive && enemy.abilityElapsed <= enemy.getTelegraphDuration();
      const close = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) <= 86;
      if (!winding || !close) { enemy.reading = 0; continue; }
      const was = enemy.reading;
      enemy.reading += delta;
      if (was < 140 && enemy.reading >= 140) this.floatText(enemy.x, enemy.y - 34, '读招', '#fff1c7');
      if (!enemy.stagger()) continue;
      const bite = Math.max(10, Math.round(12 + enemy.stage * 3));
      this.hurtPlayer(bite);
      const away = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      this.player.setPosition(
        Phaser.Math.Clamp(this.player.x + Math.cos(away) * 92, 28, GAME_WIDTH - 28),
        Phaser.Math.Clamp(this.player.y + Math.sin(away) * 92, 78, GAME_HEIGHT - 28),
      );
      this.floatText(enemy.x, enemy.y - 28, '掐招', '#fff1c7');
      this.floatText(this.player.x, this.player.y - 24, `近身反噬 -${bite}`, '#ffb0b0');
    }
  }

  private recoverCover(_delta: number): void {
    for (const enemy of this.enemies.getChildren() as PhantomEntity[]) {
      if (!enemy.active || enemy.cover <= 0 || this.time.now <= enemy.coverUntil) continue;
      const tail = this.linkedNeighbors(enemy).find((other) => this.linkedNeighbors(other).length < 2);
      const anchor = tail ?? enemy;
      const across = new Phaser.Math.Vector2(this.player.x - enemy.x, this.player.y - enemy.y);
      const flank = new Phaser.Math.Vector2(anchor.x - enemy.x, anchor.y - enemy.y);
      const behind = flank.lengthSq() > 1 && across.dot(flank) < 0 && across.length() <= 120;
      if (!behind) {
        if (!enemy.getData('coverHeld')) {
          enemy.setData('coverHeld', 1);
          this.floatText(enemy.x, enemy.y - 18, '掩体还在 · 绕到另一侧', '#ffb0b0');
        }
        continue;
      }
      enemy.setData('coverHeld', 0);
      enemy.cover -= 1;
      enemy.coverUntil = this.time.now + 700;
      this.floatText(enemy.x, enemy.y - 18, enemy.cover > 0 ? `绕后剥层 ${enemy.cover}/3` : '绕后拆光', '#ffe28a');
    }
    if (!Phaser.Input.Keyboard.JustDown(this.keys.M)) return;
    let nearest: PhantomEntity | undefined;
    let best = 78;
    for (const enemy of this.enemies.getChildren() as PhantomEntity[]) {
      if (!enemy.active || enemy.isBoss || enemy.cover > 0 || this.linkedNeighbors(enemy).length < 2) continue;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (distance < best) { best = distance; nearest = enemy; }
    }
    if (!nearest) {
      this.floatText(this.player.x, this.player.y - 24, '附近没有可修的链心', '#ffb0b0');
      return;
    }
    nearest.exposedUntilStamp = 0;
    nearest.cover = 3;
    nearest.coverUntil = this.time.now + 1400;
    nearest.coverSpite = true;
    const bite = Math.max(6, Math.round(this.player.maxHealth * 0.06));
    this.hurtPlayer(bite);
    this.floatText(nearest.x, nearest.y - 18, `主动加固 · 反噬 -${bite}`, '#ffd467');
  }
  private chargeLinks(delta: number): void {
    const armed = (this.enemies.getChildren() as PhantomEntity[]).filter((enemy) => enemy.active && enemy.charge > 0);
    if (!this.overheated || !this.keys.SHIFT.isDown) {
      if (armed.length === 0) return;
      for (const enemy of armed) enemy.charge = 0;
      this.floatText(this.player.x, this.player.y - 24, '引信熄火', '#d7ecff');
      return;
    }
    const flight = this.player.body?.velocity;
    const moving = !!flight && flight.lengthSq() > 400;
    const near = (this.enemies.getChildren() as PhantomEntity[]).filter((enemy) => enemy.active && !enemy.isBoss && (enemy.charge > 0 || Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) <= 120));
    let brushing = false;
    if (moving) for (const enemy of near) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (dist <= 68) brushing = true;
    }
    this.chargeClock -= delta * (brushing ? 1.6 : 0.25);
    if (armed.length > 0 && brushing && this.player.getData('fuseBrush') !== 1) { this.player.setData('fuseBrush', 1); this.floatText(this.player.x, this.player.y - 18, '掠过引信 · 加速引燃', '#ffd0a8'); }
    else if (armed.length > 0 && !brushing && this.player.getData('fuseBrush') !== 2) { this.player.setData('fuseBrush', 2); this.floatText(this.player.x, this.player.y - 18, '没贴引信 · 燃烧极慢', '#ffb0b0'); }
    else if (armed.length === 0) this.player.setData('fuseBrush', 0);
    if (this.chargeClock > 0) return;
    this.chargeClock = 450;
    for (const enemy of near) {
      enemy.charge = enemy.charge === 0 ? 2 : enemy.charge - 1;
      if (enemy.charge > 0) { this.floatText(enemy.x, enemy.y - 16, `引信 ${enemy.charge}`, '#ffb0b0'); continue; }
      this.overload(enemy, 1);
    }
  }
  private updateCore(delta: number): void {
    if (!this.bossCore) { this.coreClock = 0; return; }
    const edge = Math.min(this.player.x, GAME_WIDTH - this.player.x, this.player.y, GAME_HEIGHT - this.player.y) <= 100;
    if (edge) {
      this.coreClock = 0;
      if (!this.player.getData('coreEdge')) {
        this.player.setData('coreEdge', 1);
        this.floatText(this.player.x, this.player.y - 20, '贴边压住核心', '#ffe28a');
      }
      return;
    }
    if (this.player.getData('coreEdge')) {
      this.player.setData('coreEdge', 0);
      this.floatText(this.player.x, this.player.y - 20, '离开边缘 · 核心发烫', '#ffb0b0');
    }
    const boss = (this.enemies.getChildren() as PhantomEntity[]).find((enemy) => enemy.active && enemy.isBoss);
    const flight = this.player.body?.velocity;
    const moving = !!flight && flight.lengthSq() > 400;
    const toPlayer = boss ? new Phaser.Math.Vector2(this.player.x - boss.x, this.player.y - boss.y) : new Phaser.Math.Vector2();
    const fleeing = moving && boss && flight.dot(toPlayer) > flight.length() * toPlayer.length() * 0.45;
    const facing = moving && boss && flight.dot(toPlayer) < -flight.length() * toPlayer.length() * 0.45;
    const rate = fleeing ? 2.1 : facing ? 0.35 : 1;
    this.coreClock += delta * rate;
    if (fleeing && this.player.getData('coreFlee') !== 1) { this.player.setData('coreFlee', 1); this.floatText(this.player.x, this.player.y - 34, '背身逃窜 · 核心加剧', '#ff7a8a'); }
    else if (facing && this.player.getData('coreFlee') !== 2) { this.player.setData('coreFlee', 2); this.floatText(this.player.x, this.player.y - 34, '直面 Boss · 压住灼热', '#ffe28a'); }
    else if (!fleeing && !facing) this.player.setData('coreFlee', 0);
    if (this.coreClock < 700) return;
    this.coreClock = 0;
    this.hurtPlayer(Math.max(4, Math.round(this.player.maxHealth * 0.035)));
    this.floatText(this.player.x, this.player.y - 20, '核心灼烧', '#ff7a8a');
  }

  private updateHover(delta: number): void {
    const flight = this.player.body?.velocity;
    const moving = !!flight && flight.lengthSq() > 400;
    const enemies = (this.enemies.getChildren() as PhantomEntity[]).filter((enemy) => enemy.active);
    let threading = false;
    if (moving) for (const enemy of enemies) {
      for (const other of enemies) {
        if (other === enemy) continue;
        const bridge = new Phaser.Math.Vector2(other.x - enemy.x, other.y - enemy.y);
        const span = bridge.length();
        if (span < 80 || span > 220) continue;
        const toPlayer = new Phaser.Math.Vector2(this.player.x - enemy.x, this.player.y - enemy.y);
        const along = toPlayer.dot(bridge) / span;
        const off = toPlayer.clone().subtract(bridge.clone().scale(along / span)).length();
        if (along > 16 && along < span - 16 && off <= 24) threading = true;
      }
    }
    this.hoverLock = Math.max(0, this.hoverLock - delta * (threading ? 2.6 : 0.35));
    if (this.hoverLock > 0 && threading && this.player.getData('hoverThread') !== 1) { this.player.setData('hoverThread', 1); this.floatText(this.player.x, this.player.y - 18, '穿过敌缝 · 盘旋提前解开', '#b8fff4'); }
    else if (this.hoverLock > 0 && !threading && this.player.getData('hoverThread') !== 2) { this.player.setData('hoverThread', 2); this.floatText(this.player.x, this.player.y - 18, '没穿过敌缝 · 盘旋锁得很慢', '#ffb0b0'); }
    else if (this.hoverLock <= 0) this.player.setData('hoverThread', 0);
    if (!this.hover) return;
    this.heat = Math.min(100, this.heat + delta * 0.055);
    if (this.heat >= 100) {
      this.overheated = true;
      this.hover = false;
      this.hoverLock = 2500;
      this.player.clearTint();
      this.floatText(this.player.x, this.player.y - 24, '过热 · 盘旋中断', '#ffb0b0');
    }
  }

  private advanceChapter(delta: number): void {
    const edge = Math.min(this.player.x, GAME_WIDTH - this.player.x, this.player.y, GAME_HEIGHT - this.player.y);
    const inside = edge > 120;
    this.encounter.addTime(inside ? delta : delta * 0.2);
    const state = inside ? 1 : 2;
    if (!this.boss && !this.finalBossDefeated && this.player.getData('chapterPace') !== state) {
      this.player.setData('chapterPace', state);
      this.floatText(this.player.x, this.player.y - 18, inside ? '留在场内 · 章节推进' : '贴边拖延 · 章节几乎停住', inside ? '#ffe28a' : '#ffb0b0');
    }
  }

  private rechargeDash(delta: number): void {
    if (this.skillClock <= 0) {
      this.player.setData('dashCharge', 0);
      return;
    }
    let nearest = Number.POSITIVE_INFINITY;
    for (const enemy of this.enemies.getChildren() as PhantomEntity[]) {
      if (!enemy.active || enemy.health <= 0) continue;
      nearest = Math.min(nearest, Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y));
    }
    const flight = this.player.body?.velocity;
    const weaving = !!flight && flight.lengthSq() > 400 && nearest <= 150;
    const rate = weaving ? 1.65 : nearest <= 230 ? 1 : 0.22;
    this.skillClock = Math.max(0, this.skillClock - delta * rate);
    const state = weaving ? 1 : nearest <= 230 ? 3 : 2;
    if (this.player.getData('dashCharge') !== state) {
      this.player.setData('dashCharge', state);
      this.floatText(this.player.x, this.player.y - 18, weaving ? '贴着敌群掠过 · 冲刺回充' : nearest <= 230 ? '靠近敌群 · 冲刺续充' : '脱离敌群 · 冲刺几乎不回', weaving || nearest <= 230 ? '#b8fff4' : '#ffb0b0');
    }
  }

  private useSkill(): void { if (this.paused || this.skillClock > 0) return; this.skillClock = 12000;
    const spent = this.grazeCharge; this.grazeCharge = 0; const venting = this.heat >= 70; const ventHeat = this.heat; const fullVent = this.overheated; const afterburnBonus = this.afterburn > 0 ? 1.5 : 1; const spentAfterburn = afterburnBonus > 1 && !venting;
    const aim = this.touchActive
      ? new Phaser.Math.Vector2(this.touchX - this.player.x, this.touchY - this.player.y)
      : new Phaser.Math.Vector2((this.cursors.right.isDown || this.keys.D.isDown ? 1 : 0) - (this.cursors.left.isDown || this.keys.A.isDown ? 1 : 0), (this.cursors.down.isDown || this.keys.S.isDown ? 1 : 0) - (this.cursors.up.isDown || this.keys.W.isDown ? 1 : 0));
    this.hover = this.heat >= 70 && !this.overheated && this.hoverLock <= 0; if (this.hover) this.player.setTint(0xb8fff4); else this.player.clearTint(); if (venting) { this.heat = 0; this.overheated = false; } else { this.heat = Math.max(0, this.heat - 40); if (this.heat <= 25) this.overheated = false; } if (aim.lengthSq() > 0.01) { aim.normalize().scale(this.player.hurt ? 90 : 260); this.player.setPosition(Phaser.Math.Clamp(this.player.x + aim.x, 28, GAME_WIDTH - 28), Phaser.Math.Clamp(this.player.y + aim.y, 78, GAME_HEIGHT - 28)); }
    this.burst(this.player.x, this.player.y, 0x6fffff, 35); const ring = this.add.rectangle(this.player.x, this.player.y, 20, 20).setStrokeStyle(5, 0x68f9ef).setDepth(8); this.tweens.add({ targets: ring, scale: venting ? 25 + ventHeat / 8 : 8, alpha: 0, duration: 400, onComplete: () => ring.destroy() }); const dashEnd = new Phaser.Math.Vector2(this.player.x, this.player.y); const start = dashEnd.clone().subtract(aim); let swept = 0; this.enemyShots.children.each((obj) => { const shot = obj as Phaser.Physics.Arcade.Image; if (!shot.active) return true; if (aim.lengthSq() > 1 && Phaser.Math.Distance.BetweenPoints(shot, this.closestPoint(start, dashEnd, shot as unknown as PhantomEntity)) < 28) { shot.destroy(); swept += 1; } return true; }); if (swept > 0) this.floatText(this.player.x, this.player.y - 18, `卷走弹幕 x${swept}`, '#b8fff4'); const targets = this.enemies.getChildren() as PhantomEntity[]; let blasted = 0; let rebounded = false; const radius = 270 + (venting ? ventHeat * 1.4 : 0);  for (const enemy of [...targets]) {
      if (!enemy.active) continue;
      const nearEnd = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) < radius;
      const along = aim.lengthSq() > 1 && Phaser.Math.Distance.BetweenPoints(enemy, this.closestPoint(start, new Phaser.Math.Vector2(this.player.x, this.player.y), enemy)) < 42;
      if (venting ? !nearEnd : !(along || Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) < 48)) continue;
      const facing = enemy.flipX ? Math.PI : 0;
      const approach = Math.atan2(this.player.y - start.y, this.player.x - start.x);
      const fromFront = Math.abs(Phaser.Math.Angle.Wrap(approach - facing - Math.PI)) < 0.9;
      const chainCore = !enemy.isBoss && this.linkedNeighbors(enemy).length >= 2;
      if (!venting && chainCore && fromFront && this.time.now >= enemy.severedUntil) {
        if (!rebounded) {
          const recoil = Math.max(8, Math.round(this.progression.state.attack * 0.4));
          this.hurtPlayer(recoil);
          const back = Math.atan2(start.y - this.player.y, start.x - this.player.x);
          this.player.setPosition(Phaser.Math.Clamp(this.player.x + Math.cos(back) * 78, 28, GAME_WIDTH - 28), Phaser.Math.Clamp(this.player.y + Math.sin(back) * 78, 78, GAME_HEIGHT - 28));
          this.wearCover(enemy, '撞链');
          this.floatText(this.player.x, this.player.y - 24, `反弹 -${recoil}`, '#ffb0b0');
          rebounded = true;
        }
        continue;
      }
      if (!venting && !this.hover) {
        if (!enemy.isBoss) {
          if (this.keys.Z.isDown) {
            const gather = Math.atan2(aim.y, aim.x);
            enemy.setPosition(
              Phaser.Math.Clamp(this.player.x + Math.cos(gather) * (70 + blasted * 18), 48, GAME_WIDTH - 48),
              Phaser.Math.Clamp(this.player.y + Math.sin(gather) * (70 + blasted * 18), 90, GAME_HEIGHT - 48),
            );
            enemy.shoveUntil = this.time.now + 280;
            enemy.severedUntil = 0;
          } else {
            const away = Phaser.Math.Angle.Between(start.x, start.y, enemy.x, enemy.y);
            enemy.shoveUntil = this.time.now + 280;
            enemy.setVelocity(Math.cos(away) * 220, Math.sin(away) * 220);
          }
        }
        blasted += 1;
        continue;
      }
      this.hitEnemy(enemy, this.progression.state.attack * (8 + spent * 6) * (venting ? (1 + ventHeat / 80) * (fullVent ? 2 : 1) : 1) * afterburnBonus); blasted += 1;
      if (!venting && !enemy.isBoss) this.breakLinks(enemy);
    } if (venting) { const burn = Math.max(0, Math.round(ventHeat / 5) - blasted * 6); if (burn > 0) this.hurtPlayer(burn); this.floatText(this.player.x, this.player.y - 48, burn > 0 ? `${fullVent ? '满热爆' : '热爆'} -${burn}` : `${fullVent ? (this.strafing ? '侧扫余热' : '正爆无余热') : '热爆'} x${blasted}`, '#ffb0b0'); if (fullVent && blasted > 0 && this.strafing) this.afterburn = 4000; else if (fullVent) this.afterburn = 0; } else this.floatText(this.player.x, this.player.y - 48, this.hover ? '盘旋 · 贴身' : this.keys.Z.isDown ? `收链 x${blasted}` : '冲刺', '#b8fff4'); if (spentAfterburn && blasted > 0) { this.afterburn = 0; this.floatText(this.player.x, this.player.y - 62, '余热冲刺', '#ffd0a8'); } if (spent > 0) this.floatText(this.player.x, this.player.y - 34, `擦弹爆发 x${spent}`, '#9af6ff'); }



  private updateChains(delta: number): void {
    const raging = (this.enemies.getChildren() as PhantomEntity[]).some((enemy) => enemy.active && enemy.isBoss && enemy.enragedUntil > this.time.now);
    if (!raging) this.bossCore = false;
    let onVolley = this.chainAim.size === 0;
    for (const [enemy, angle] of this.chainAim) {
      if (!enemy.active) continue;
      const lane = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
      const toPlayer = new Phaser.Math.Vector2(this.player.x - enemy.x, this.player.y - enemy.y);
      const along = toPlayer.dot(lane);
      const off = toPlayer.clone().subtract(lane.clone().scale(along)).length();
      if (along > 24 && along < 170 && off <= 28) onVolley = true;
      this.warning.lineStyle(3, 0xd7c8ff, 0.8).lineBetween(enemy.x, enemy.y, enemy.x + Math.cos(angle) * 150, enemy.y + Math.sin(angle) * 150);
    }
    this.chainClock -= delta * (onVolley ? 1 : 0.28);
    if (this.chainAim.size > 0 && onVolley && this.player.getData('volleyLane') !== 1) { this.player.setData('volleyLane', 1); this.floatText(this.player.x, this.player.y - 18, '站上齐射线 · 下一发加快', '#d7c8ff'); }
    else if (this.chainAim.size > 0 && !onVolley && this.player.getData('volleyLane') !== 2) { this.player.setData('volleyLane', 2); this.floatText(this.player.x, this.player.y - 18, '离开齐射线 · 下一发拖住', '#ffb0b0'); }
    else if (this.chainAim.size === 0) this.player.setData('volleyLane', 0);
    if (this.chainClock > 0) return;
    if (!this.keys.C.isDown) {
      if (this.chainAim.size > 0) this.floatText(this.player.x, this.player.y - 24, '没按住，齐射散了', '#ffb0b0');
      this.chainAim.clear();
      this.chainClock = 1600;
      return;
    }
    const pending = new Map(this.chainAim);
    this.chainAim.clear();
    const mobs = (this.enemies.getChildren() as PhantomEntity[]).filter((enemy) => enemy.active && !enemy.isBoss);
    const seen = new Set<PhantomEntity>();
    for (const enemy of mobs) {
      if (seen.has(enemy)) continue;
      const group = [enemy];
      seen.add(enemy);
      for (let i = 0; i < group.length; i += 1) for (const other of mobs) {
        if (seen.has(other)) continue;
        if (Phaser.Math.Distance.Between(group[i].x, group[i].y, other.x, other.y) > 90) continue;
        seen.add(other);
        group.push(other);
      }
      if (group.length < 3) continue;
      const boss = (this.enemies.getChildren() as PhantomEntity[]).find((enemy) => enemy.active && enemy.isBoss && group.some((mob) => Phaser.Math.Distance.Between(enemy.x, enemy.y, mob.x, mob.y) <= 120));
      const playerNear = group.some((mob) => Phaser.Math.Distance.Between(this.player.x, this.player.y, mob.x, mob.y) <= 140);
      if (boss && playerNear && this.stall > 180) { boss.feed(700); this.floatText(boss.x, boss.y - 18, '停在链边 · 供能', '#ffb0b0'); }
      else if (boss && playerNear) this.floatText(boss.x, boss.y - 18, '飞开 · 断供', '#ffe28a');
      const anchor = group[0];
      const aimed = pending.get(anchor);
      const angle = aimed ?? Phaser.Math.Angle.Between(anchor.x, anchor.y, this.player.x, this.player.y);
      if (aimed === undefined) { const velocity = this.player.body?.velocity; const moving = !!velocity && velocity.lengthSq() > 400; const slip = moving ? Math.atan2(velocity.y, velocity.x) + Math.PI / 2 : angle; this.chainAim.set(anchor, slip); this.floatText(anchor.x, anchor.y - 16, moving ? '齐射看你横移' : '停住被锁', moving ? '#ffe28a' : '#ffb0b0'); }
      else if (group.length >= 3) { for (const offset of [-0.18, 0.18]) this.enemyShot(anchor, angle + offset); this.floatText(anchor.x, anchor.y - 16, '锁链齐射', '#d7c8ff'); }
      else this.floatText(anchor.x, anchor.y - 16, '齐射取消', '#ffe28a');
    }
    this.chainClock = this.chainAim.size > 0 ? 420 : 1600;
  }
  private breakLinks(source: PhantomEntity): void {
    const seen = new Set<PhantomEntity>([source]);
    const queue = [source];
    let blocked = 0;
    while (queue.length > 0) {
      const current = queue.pop()!;
      for (const other of this.enemies.getChildren() as PhantomEntity[]) {
        if (!other.active || other.isBoss || seen.has(other)) continue;
        if (Phaser.Math.Distance.Between(current.x, current.y, other.x, other.y) > 90) continue;
        const bridge = new Phaser.Math.Vector2(other.x - current.x, other.y - current.y);
        const toPlayer = new Phaser.Math.Vector2(this.player.x - current.x, this.player.y - current.y);
        const span = bridge.length();
        const along = span > 1 ? toPlayer.dot(bridge) / span : -1;
        const offLane = span > 1 ? toPlayer.clone().subtract(bridge.clone().scale(along / span)).length() : 999;
        if (!(along > 16 && along < span - 16 && offLane <= 32)) { blocked += 1; continue; }
        seen.add(other);
        other.exposedUntil = this.time.now + 1400;
        const away = Phaser.Math.Angle.Between(source.x, source.y, other.x, other.y);
        other.shoveUntil = this.time.now + 280; other.setVelocity(Math.cos(away) * 240, Math.sin(away) * 240);
        queue.push(other);
      }
    }
    if (seen.size > 1) this.floatText(source.x, source.y - 18, `站上断链 x${seen.size - 1}`, '#ffe28a');
    else if (blocked > 0) this.floatText(source.x, source.y - 18, '没站在链上 · 断链没传开', '#ffb0b0');
  }
  private closestPoint(start: Phaser.Math.Vector2, end: Phaser.Math.Vector2, enemy: PhantomEntity): Phaser.Math.Vector2 {
    const line = end.clone().subtract(start);
    const length = line.lengthSq();
    if (length < 1) return end;
    const t = Phaser.Math.Clamp(new Phaser.Math.Vector2(enemy.x, enemy.y).subtract(start).dot(line) / length, 0, 1);
    return start.clone().add(line.scale(t));
  }
  private panel(title: string): void { this.paused = true; this.physics.pause(); this.touchActive = false; this.overlay?.destroy(); this.overlay = this.add.container(0, 0).setDepth(30); this.overlay.add(this.add.rectangle(480, 270, 960, 540, 0x080e16, 0.8)); this.overlay.add(this.add.rectangle(480, 270, 700, 370, 0x202c33).setStrokeStyle(4, 0x728f7a)); this.overlay.add(this.add.text(480, 126, title, { color: '#fff1c7', fontSize: '28px', fontStyle: 'bold' }).setOrigin(0.5)); }
  private button(y: number, label: string, action: () => void): void { const b = this.add.text(480, y, label, { color: '#e8ffe5', backgroundColor: '#344d45', fontSize: '19px', padding: { x: 22, y: 13 } }).setOrigin(0.5).setInteractive({ useHandCursor: true }); b.on('pointerdown', action); this.overlay!.add(b); }
  private closePanel(): void { this.overlay?.destroy(); this.overlay = undefined; this.paused = false; this.physics.resume(); if (this.economy.pendingUpgrades) this.showUpgrade(); }
  private showUpgrade(): void {
    this.panel('附魔台 · 选择一项升级');
    const choose = (id: EnchantId) => {
      const heal = this.economy.applyEnchant(id, this.progression.state);
      this.player.maxHealth = this.progression.state.maxHealth;
      this.player.health = Math.min(this.player.maxHealth, this.player.health + heal);
      this.economy.consumeUpgrade();
      this.closePanel();
    };
    this.economy.rollOffers().forEach((offer, index) => this.button(180 + index * 62, offer.label, () => choose(offer.id)));
    this.button(390, '先压着 · 回到战场再选', () => this.holdUpgrade());
  }
  private holdUpgrade(): void {
    this.overlay?.destroy();
    this.overlay = undefined;
    this.paused = false;
    this.physics.resume();
    this.floatText(this.player.x, this.player.y - 24, '附魔先压着 · 按 E', '#ffe28a');
  }
  private showShop(): void {
    this.panel(`流浪商人 · ${this.economy.gems} 绿宝石`);
    const buy = (id: ShopId) => {
      const result = this.economy.purchase(id, this.progression.state);
      if (!result.ok) return;
      this.player.maxHealth = this.progression.state.maxHealth;
      if (result.heal) this.player.health = Math.min(this.player.maxHealth, this.player.health + result.heal);
      this.showShop();
    };
    this.economy.catalog(this.progression.state.speed).forEach((offer, index) => this.button(183 + index * 57, offer.label, () => buy(offer.id)));
    this.button(422, '返回战场', () => this.closePanel());
  }
  private hurtPlayer(amount: number): void {
    if (!this.player.damage(amount) || this.combo < 2) return;
    const lost = this.combo;
    if (this.economy.hooks > 0) { this.comboBank = this.combo; this.comboGrace = 2000; this.player.setData('comboDropX', this.player.x); this.player.setData('comboDropY', this.player.y); }
    else this.comboBank = 0;
    this.combo = 0;
    this.comboClock = 0;
    this.floatText(this.player.x, this.player.y - 42, this.comboBank > 0 ? `受击断连 x${lost}` : `连击中断 x${lost}`, '#ffb0b0');
  }

  private onEnemyContact(_playerObj: any, enemyObj: any): void {
    const enemy = enemyObj as PhantomEntity;
    if (!enemy.active) return;
    const velocity = this.player.body?.velocity;
    const enemyVelocity = enemy.body?.velocity;
    const moving = !!velocity && velocity.lengthSq() > 400;
    const enemyMoving = !!enemyVelocity && enemyVelocity.lengthSq() > 400;
    const closing = moving && enemyMoving && velocity.dot(enemyVelocity) < -velocity.length() * enemyVelocity.length() * 0.35;
    const glancing = moving && enemyMoving && !closing;
    const bite = enemy.contactDamage * (enemy.grudging ? 1.35 : 1) * (closing ? 1 : glancing ? 0.35 : 0.7);
    this.hurtPlayer(bite);
    if (closing && enemy.getData('contactCall') !== 1) { enemy.setData('contactCall', 1); this.floatText(this.player.x, this.player.y - 18, '迎面撞上', '#ffb0b0'); }
    else if (glancing && enemy.getData('contactCall') !== 2) { enemy.setData('contactCall', 2); this.floatText(this.player.x, this.player.y - 18, '平行擦过 · 只蹭一层', '#ffe28a'); }
    else if (!moving || !enemyMoving) enemy.setData('contactCall', 0);
    if (enemy.isBoss) return;
    const away = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
    if (moving) {
      enemy.setVelocity(Math.cos(away) * 180, Math.sin(away) * 180);
      return;
    }
    const last = Number(enemy.getData('bodyCheck') ?? 0);
    if (this.time.now - last < 450) return;
    enemy.setData('bodyCheck', this.time.now);
    enemy.health = Math.max(1, enemy.health - this.progression.state.attack * 0.15);
    this.floatText(enemy.x, enemy.y - 16, '停住研磨', '#fff1c7');
  }
  private parryShot(): void {
    let nearest: Phaser.Physics.Arcade.Image | undefined;
    let best = 46;
    this.enemyShots.children.each((obj) => {
      const shot = obj as Phaser.Physics.Arcade.Image;
      if (!shot.active || Number(shot.getData('friendly') ?? 0) > 0) return true;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, shot.x, shot.y);
      if (distance < best) { best = distance; nearest = shot; }
      return true;
    });
    if (!nearest) {
      const bite = Math.max(6, Math.round(this.progression.state.attack * 0.25));
      this.hurtPlayer(bite);
      this.floatText(this.player.x, this.player.y - 24, `弹反落空 -${bite}`, '#ffb0b0');
      return;
    }
    const velocity = nearest.body?.velocity;
    const incoming = velocity && velocity.lengthSq() > 1 ? Math.atan2(velocity.y, velocity.x) : Phaser.Math.Angle.Between(nearest.x, nearest.y, this.player.x, this.player.y);
    const flight = this.player.body?.velocity;
    const moving = !!flight && flight.lengthSq() > 400;
    const into = moving && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(flight.y, flight.x) - incoming - Math.PI)) < 0.55;
    nearest.setData('grazed', 1);
    if (!into) {
      const shove = incoming + Math.PI / 2;
      nearest.setVelocity(Math.cos(shove) * 180, Math.sin(shove) * 180);
      this.floatText(nearest.x, nearest.y - 16, '没迎上去 · 弹被拨开', '#ffb0b0');
      return;
    }
    const back = Phaser.Math.Angle.Between(this.player.x, this.player.y, nearest.x, nearest.y);
    nearest.setData('friendly', Math.round(this.progression.state.attack * 2.4));
    nearest.setData('born', this.time.now);
    nearest.setVelocity(Math.cos(back) * 320, Math.sin(back) * 320);
    nearest.setTint(0xb8fff4);
    this.floatText(nearest.x, nearest.y - 16, '迎面弹反', '#b8fff4');
  }

  private grazeShots(): void {
    const flight = this.player.body?.velocity;
    const moving = !!flight && flight.lengthSq() > 400;
    let sliced = 0;
    let slipped = 0;
    this.enemyShots.children.each((obj) => {
      const shot = obj as Phaser.Physics.Arcade.Image;
      if (!shot.active || shot.getData('grazed')) return true;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, shot.x, shot.y);
      if (distance >= 34 || distance <= 16) return true;
      const velocity = shot.body?.velocity;
      const shotAngle = velocity && velocity.lengthSq() > 1 ? Math.atan2(velocity.y, velocity.x) : Phaser.Math.Angle.Between(shot.x, shot.y, this.player.x, this.player.y);
      const across = moving && Math.abs(Math.sin(Math.atan2(flight.y, flight.x) - shotAngle)) > 0.72;
      const sameWay = moving && Math.cos(Math.atan2(flight.y, flight.x) - shotAngle) > 0.55;
      // Standing still or flying head-on is not a graze. Let physics resolve the hit.
      if (!across && !sameWay) return true;
      shot.setData('grazed', 1);
      if (sameWay) {
        const shove = shotAngle + Math.PI / 2 * (Math.sin(Math.atan2(this.player.y - shot.y, this.player.x - shot.x) - shotAngle) >= 0 ? 1 : -1);
        shot.setVelocity(Math.cos(shove) * 150, Math.sin(shove) * 150);
        slipped += 1;
        return true;
      }
      sliced += 1;
      return true;
    });
    if (slipped > 0) this.floatText(this.player.x, this.player.y - 26, '顺着飞 · 弹被挤开', '#ffb0b0');
    if (sliced === 0 || !this.keys.CTRL.isDown) {
      if (sliced > 0) this.floatText(this.player.x, this.player.y - 40, '横切到了 · 没按住擦弹', '#ffb0b0');
      return;
    }
    this.skillClock = Math.max(0, this.skillClock - 700);
    this.comboClock = Math.max(this.comboClock, 1800);
    this.grazeCharge = Math.min(3, this.grazeCharge + sliced);
    this.heat = Math.min(100, this.heat + 8 * sliced);
    if (this.heat >= 100 && !this.overheated) { this.overheated = true; this.floatText(this.player.x, this.player.y - 42, '擦弹过热', '#ffb0b0'); }
    this.floatText(this.player.x, this.player.y - 26, `横切擦弹 x${this.grazeCharge}`, '#9af6ff');
  }

  private onFriendlyShot(shotObj: unknown, enemyObj: unknown): void {
    const shot = shotObj as Phaser.Physics.Arcade.Image;
    const enemy = enemyObj as PhantomEntity;
    const damage = Number(shot.getData('friendly') ?? 0);
    const age = this.time.now - Number(shot.getData('born') ?? this.time.now);
    if (!shot.active || !enemy.active || enemy.isBoss || damage <= 0 || age < 120) return;
    const velocity = shot.body?.velocity;
    if (!velocity || velocity.lengthSq() < 1) return;
    const flight = new Phaser.Math.Vector2(velocity.x, velocity.y).normalize();
    const ahead = flight.dot(new Phaser.Math.Vector2(enemy.x - this.player.x, enemy.y - this.player.y));
    if (ahead <= 24) {
      if (!shot.getData('shadowed')) {
        shot.setData('shadowed', 1);
        this.floatText(shot.x, shot.y - 14, '没从你身前穿出', '#ffb0b0');
      }
      return;
    }
    shot.setData('friendly', 0);
    this.hitEnemy(enemy, damage);
    this.floatText(enemy.x, enemy.y - 18, '身前穿出', '#fff1c7');
  }



  private blocksPlayerShot(shot: ProjectileEntity, target?: PhantomEntity): PhantomEntity | undefined {
    if (!target?.active) return undefined;
    const cores = (this.enemies.getChildren() as PhantomEntity[]).filter((enemy) => enemy.active && !enemy.isBoss && enemy !== target && this.time.now >= enemy.severedUntil && this.linkedNeighbors(enemy).length >= 2);
    for (const core of cores) {
      if (this.linkedNeighbors(core).includes(target)) continue;
      if (Phaser.Math.Distance.Between(shot.x, shot.y, core.x, core.y) > 30) continue;
      if (Phaser.Math.Distance.Between(core.x, core.y, target.x, target.y) + 24 < Phaser.Math.Distance.Between(shot.x, shot.y, target.x, target.y)) return core;
    }
    return undefined;
  }


  private wearCover(cover: PhantomEntity, blockedLabel: string): void {
    if (cover.coverSpite) {
      cover.coverSpite = false;
      const bite = Math.max(8, Math.round(this.progression.state.attack * 0.35));
      this.hurtPlayer(bite);
      const away = Phaser.Math.Angle.Between(cover.x, cover.y, this.player.x, this.player.y);
      this.player.setPosition(
        Phaser.Math.Clamp(this.player.x + Math.cos(away) * 64, 28, GAME_WIDTH - 28),
        Phaser.Math.Clamp(this.player.y + Math.sin(away) * 64, 78, GAME_HEIGHT - 28),
      );
      this.floatText(this.player.x, this.player.y - 24, `加固反噬 -${bite}`, '#ffb0b0');
    }
    cover.cover += 1;
    cover.coverUntil = this.time.now + 1400;
    if (cover.cover >= 3) {
      cover.cover = 0;
      cover.severedUntil = this.time.now + 1600;
      cover.exposedUntilStamp = this.time.now + 1600;
      for (const tail of this.linkedNeighbors(cover)) {
        if (this.linkedNeighbors(tail).length >= 2) continue;
        const bridge = new Phaser.Math.Vector2(tail.x - cover.x, tail.y - cover.y);
        const toPlayer = new Phaser.Math.Vector2(this.player.x - cover.x, this.player.y - cover.y);
        const span = bridge.length();
        const along = span > 1 ? toPlayer.dot(bridge) / span : -1;
        const offLane = span > 1 ? toPlayer.clone().subtract(bridge.clone().scale(along / span)).length() : 999;
        if (!(along > 16 && along < span - 16 && offLane <= 32)) {
          this.floatText(tail.x, tail.y - 16, '没站在尾链上 · 尾部没被震开', '#ffb0b0');
          continue;
        }
        const away = Phaser.Math.Angle.Between(cover.x, cover.y, tail.x, tail.y);
        tail.shoveUntil = this.time.now + 700;
        tail.severedUntil = this.time.now + 1600;
        tail.setVelocity(Math.cos(away) * 260, Math.sin(away) * 260);
        this.floatText(tail.x, tail.y - 16, '站上尾链 · 震开', '#ffe28a');
      }
      this.floatText(cover.x, cover.y - 18, '掩体打穿', '#ffb0b0');
      return;
    }
    this.floatText(cover.x, cover.y - 18, `${blockedLabel} ${cover.cover}/3`, '#d7ecff');
  }
  private absorbPlayerShot(shot: ProjectileEntity, cover: PhantomEntity): void {
    const damage = Number(shot.getData('damage') ?? this.progression.state.attack);
    shot.destroy();
    const tail = this.linkedNeighbors(cover).find((enemy) => this.linkedNeighbors(enemy).length < 2);
    if (tail) this.hitEnemy(tail, damage * 0.45);
    this.wearCover(cover, '掩体挡住');
  }
  private absorbCover(shot: Phaser.Physics.Arcade.Image, cover: PhantomEntity): void {
    const damage = Number(shot.getData('damage') ?? 8);
    shot.destroy();
    const tail = this.linkedNeighbors(cover).find((enemy) => this.linkedNeighbors(enemy).length < 2);
    if (tail) this.hitEnemy(tail, damage);
    this.wearCover(cover, '锁链拦下');
  }
  private blocksShot(shot: Phaser.Physics.Arcade.Image): PhantomEntity | undefined {
    const velocity = shot.body?.velocity;
    if (!velocity || velocity.lengthSq() < 1) return undefined;
    const mobs = (this.enemies.getChildren() as PhantomEntity[]).filter((enemy) => enemy.active && !enemy.isBoss && this.time.now >= enemy.severedUntil && this.linkedNeighbors(enemy).length >= 2);
    for (const enemy of mobs) {
      if (Phaser.Math.Distance.Between(shot.x, shot.y, enemy.x, enemy.y) > 30) continue;
      const towardPlayer = new Phaser.Math.Vector2(this.player.x - shot.x, this.player.y - shot.y);
      const towardCover = new Phaser.Math.Vector2(enemy.x - shot.x, enemy.y - shot.y);
      if (towardPlayer.dot(towardCover) > 0 && Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) + 20 < Phaser.Math.Distance.Between(shot.x, shot.y, this.player.x, this.player.y)) return enemy;
    }
    return undefined;
  }

  private onEnemyShotHit(_playerObj: any, shotObj: any): void {
    const shot = shotObj as Phaser.Physics.Arcade.Image;
    if (!shot.active) return;
    const before = this.player.health;
    const velocity = shot.body?.velocity;
    const flight = this.player.body?.velocity;
    const moving = !!flight && flight.lengthSq() > 400;
    const shotMoving = !!velocity && velocity.lengthSq() > 1;
    const sameWay = moving && shotMoving && flight.dot(velocity) > flight.length() * velocity.length() * 0.55;
    this.hurtPlayer(Number(shot.getData('damage') ?? 8) * (sameWay ? 0.4 : 1));
    if (sameWay && !shot.getData('sameWay')) { shot.setData('sameWay', 1); this.floatText(this.player.x, this.player.y - 30, '顺着弹幕滑过', '#ffe28a'); }
    if (this.player.health < before) {
      const shotAngle = velocity && velocity.lengthSq() > 1 ? Math.atan2(velocity.y, velocity.x) : Phaser.Math.Angle.Between(shot.x, shot.y, this.player.x, this.player.y);
      const crossing = moving && Math.abs(Math.sin(Math.atan2(flight.y, flight.x) - shotAngle)) > 0.72;
      const kick = crossing ? Math.atan2(flight.y, flight.x) : shotAngle;
      const distance = crossing ? 16 : 46;
      this.player.setPosition(Phaser.Math.Clamp(this.player.x + Math.cos(kick) * distance, 28, GAME_WIDTH - 28), Phaser.Math.Clamp(this.player.y + Math.sin(kick) * distance, 78, GAME_HEIGHT - 28));
      this.floatText(this.player.x, this.player.y - 18, crossing ? '横穿滑开' : '迎面弹飞', crossing ? '#ffe28a' : '#ffb0b0');
    }
    shot.destroy();
  }
  private resolveAbility(enemy: PhantomEntity, delta: number): void {
    if (enemy.variant === 'phantom' && enemy.abilityActive && enemy.abilityElapsed > enemy.getTelegraphDuration() && !enemy.getData('lunged')) {
      enemy.setData('lunged', 1);
      const velocity = this.player.body?.velocity;
      const moving = !!velocity && velocity.lengthSq() > 400;
      const across = moving && Math.abs(Math.sin(Math.atan2(velocity.y, velocity.x) - enemy.lockedAngle)) > 0.72;
      const aim = across ? enemy.lockedAngle : Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      enemy.shoveUntil = this.time.now + 260;
      enemy.setVelocity(Math.cos(aim) * (220 + enemy.stage * 8), Math.sin(aim) * (220 + enemy.stage * 8));
      this.floatText(enemy.x, enemy.y - 18, across ? '扑空' : '咬住', across ? '#ffe28a' : '#ffb0b0');
    }
    if (!enemy.abilityActive) enemy.setData('lunged', 0);
    if (!enemy.abilityActive || enemy.abilityElapsed <= enemy.getTelegraphDuration()) return;
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
    const tick = delta / 1000;
    const rage = enemy.enragedUntil > this.time.now ? 1.3 : 1;
    if (enemy.variant === 'phantom' && distance < 42) this.hurtPlayer(enemy.contactDamage * 1.4 * tick * rage);
    if (enemy.variant === 'creeper' && distance < (enemy.isBoss && enemy.phase >= 2 ? 150 : 118)) this.hurtPlayer((16 + enemy.stage * 3) * tick * rage);
    if (enemy.variant === 'creeper' && Math.floor(enemy.abilityElapsed / 180) !== Math.floor((enemy.abilityElapsed - delta) / 180)) if (!enemy.getData('cross')) {
      enemy.setData('cross', 1);
      const radius = enemy.isBoss && enemy.phase >= 2 ? 150 : 118;
      this.friendlyBlast(enemy, radius, this.progression.state.attack * 2.4);
      const velocity = this.player.body?.velocity;
      const planted = !velocity || velocity.lengthSq() <= 400;
      const inside = distance < radius;
      let opened = 0;
      if (inside && planted) for (const other of this.enemies.getChildren() as PhantomEntity[]) {
        if (!other.active || other === enemy || other.isBoss) continue;
        if (Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y) > radius) continue;
        other.exposedUntil = Math.max(other.exposedUntil, this.time.now + 1100);
        opened += 1;
      }
      this.floatText(enemy.x, enemy.y - 20, !inside ? '炸圈落空' : planted ? (opened > 0 ? `停住炸开 x${opened}` : '停住硬吃') : '冲出 · 没炸开', !inside || !planted ? '#ffe28a' : '#ffb0b0');
    }
    if (enemy.variant === 'rider' && enemy.abilityElapsed > enemy.getTelegraphDuration() + 80 && !enemy.getData('charged')) {
      enemy.setData('charged', 1);
      const velocity = this.player.body?.velocity;
      const moving = !!velocity && velocity.lengthSq() > 400;
      const across = moving && Math.abs(Math.sin(Math.atan2(velocity.y, velocity.x) - enemy.lockedAngle)) > 0.72;
      const lane = Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y) - enemy.lockedAngle));
      if (across && lane > 0.45) {
        enemy.exposedUntil = Math.max(enemy.exposedUntil, this.time.now + 900);
        this.floatText(enemy.x, enemy.y - 20, '冲锋落空', '#ffe28a');
      }
    }
    if (!enemy.abilityActive) enemy.setData('charged', 0);
    if ((enemy.variant === 'rider' || enemy.variant === 'firework') && distance < 48) this.hurtPlayer((18 + enemy.stage * 2) * tick * rage);
    if (enemy.variant === 'wither' && Math.floor(enemy.abilityElapsed / 220) !== Math.floor((enemy.abilityElapsed - delta) / 220)) {
      const velocity = this.player.body?.velocity;
      const moving = !!velocity && velocity.lengthSq() > 400;
      const across = moving && Math.abs(Math.sin(Math.atan2(velocity.y, velocity.x) - enemy.lockedAngle)) > 0.72;
      const lane = Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y) - enemy.lockedAngle));
      const slipped = across && lane > 0.5;
      const wide = enemy.isBoss && enemy.phase >= 2 ? [-0.55, -0.25, 0, 0.25, 0.55] : enemy.isBoss ? [-0.35, 0, 0.35] : [0];
      const fan = slipped ? [0] : !moving && lane < 0.25 ? wide.flatMap((offset) => [offset - 0.12, offset + 0.12]) : wide;
      for (const offset of fan) this.enemyShot(enemy, enemy.lockedAngle + offset);
      if (!enemy.getData('witherCall')) {
        enemy.setData('witherCall', 1);
        this.floatText(enemy.x, enemy.y - 20, slipped ? '弹幕收束' : !moving && lane < 0.25 ? '停住扇开' : '凋零扫射', slipped ? '#ffe28a' : '#ffb0b0');
      }
    }
    if (enemy.variant === 'firework' && enemy.abilityElapsed > enemy.getTelegraphDuration() + 360 && !enemy.getData('burst')) {
      enemy.setData('burst', 1);
      const velocity = this.player.body?.velocity;
      const moving = !!velocity && velocity.lengthSq() > 400;
      const across = moving && Math.abs(Math.sin(Math.atan2(velocity.y, velocity.x) - enemy.lockedAngle)) > 0.72;
      const lane = Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y) - enemy.lockedAngle));
      const slipped = across && lane > 0.45;
      const burstCount = enemy.isBoss && enemy.phase >= 2 ? 12 : enemy.isBoss ? 8 : 5;
      const fan = slipped ? [-0.7, -0.35, 0, 0.35, 0.7] : Array.from({ length: burstCount }, (_, i) => (Math.PI * 2 * i) / burstCount - enemy.lockedAngle);
      for (const offset of fan) this.enemyShot(enemy, enemy.lockedAngle + offset, true);
      this.floatText(enemy.x, enemy.y - 20, slipped ? '烟花顺冲' : '烟花炸开', slipped ? '#ffe28a' : '#ffb0b0');
    }
    if (!enemy.abilityActive) { enemy.setData('burst', 0); enemy.setData('cross', 0); }
    if (enemy.variant === 'warden' && distance < 190 && Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y) - enemy.lockedAngle)) < 0.16) this.hurtPlayer((12 + enemy.stage * 2) * tick * rage);
    if (enemy.variant === 'warden' && Math.floor(enemy.abilityElapsed / 160) !== Math.floor((enemy.abilityElapsed - delta) / 160)) if (!enemy.getData('cross')) {
      enemy.setData('cross', 1);
      const velocity = this.player.body?.velocity;
      const moving = !!velocity && velocity.lengthSq() > 400;
      const across = moving && Math.abs(Math.sin(Math.atan2(velocity.y, velocity.x) - enemy.lockedAngle)) > 0.72;
      const lane = Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y) - enemy.lockedAngle));
      const cut = across && lane > 0.35;
      let opened = 0;
      if (cut) for (const other of this.enemies.getChildren() as PhantomEntity[]) {
        if (!other.active || other === enemy || other.isBoss) continue;
        const offset = Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(enemy.x, enemy.y, other.x, other.y) - enemy.lockedAngle);
        const span = Phaser.Math.Distance.Between(enemy.x, enemy.y, other.x, other.y);
        if (span > 520 || Math.abs(offset) > 0.2) continue;
        other.exposedUntil = Math.max(other.exposedUntil, this.time.now + 1000);
        opened += 1;
      }
      this.friendlyBeam(enemy);
      this.floatText(enemy.x, enemy.y - 20, cut ? (opened > 0 ? `横切音波 x${opened}` : '横切音波') : '音波贯穿', cut ? '#ffe28a' : '#ffb0b0');
    }
  }

  /** Creeper and firework attacks also catch enemies the player herds into them. */
  private friendlyBlast(source: PhantomEntity, radius: number, damage: number): void {
    let caught = 0;
    let blocked = 0;
    for (const other of this.enemies.getChildren() as PhantomEntity[]) {
      if (!other.active || other === source || other.isBoss) continue;
      if (Phaser.Math.Distance.Between(source.x, source.y, other.x, other.y) > radius) continue;
      const toOther = new Phaser.Math.Vector2(other.x - source.x, other.y - source.y);
      const toPlayer = new Phaser.Math.Vector2(this.player.x - source.x, this.player.y - source.y);
      const span = toOther.length();
      const along = span > 1 ? toPlayer.dot(toOther) / span : -1;
      const offLane = span > 1 ? toPlayer.clone().subtract(toOther.clone().scale(along / span)).length() : 999;
      if (!(along > 16 && along < span - 16 && offLane <= 34)) { blocked += 1; continue; }
      this.hitEnemy(other, damage);
      caught += 1;
    }
    if (caught > 0) this.floatText(source.x, source.y - 34, `站上传导 x${caught}`, '#fff1c7');
    else if (blocked > 0) this.floatText(source.x, source.y - 34, '没站在中间，爆炸没传开', '#ffb0b0');
  }

  private friendlyBeam(source: PhantomEntity): void {
    let caught = 0;
    let blocked = 0;
    for (const other of this.enemies.getChildren() as PhantomEntity[]) {
      if (!other.active || other === source || other.isBoss) continue;
      const offset = Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(source.x, source.y, other.x, other.y) - source.lockedAngle);
      const distance = Phaser.Math.Distance.Between(source.x, source.y, other.x, other.y);
      if (distance > 520 || Math.abs(offset) > 0.16) continue;
      const beam = new Phaser.Math.Vector2(Math.cos(source.lockedAngle), Math.sin(source.lockedAngle));
      const toPlayer = new Phaser.Math.Vector2(this.player.x - source.x, this.player.y - source.y);
      const along = toPlayer.dot(beam);
      const offLane = toPlayer.clone().subtract(beam.clone().scale(along)).length();
      if (!(along > 24 && along < distance - 24 && offLane <= 32)) { blocked += 1; continue; }
      this.hitEnemy(other, this.progression.state.attack * 1.6);
      caught += 1;
    }
    if (caught > 0) this.floatText(source.x, source.y - 36, `站上音波 x${caught}`, '#fff1c7');
    else if (blocked > 0) this.floatText(source.x, source.y - 36, '没站在射线上，音波落空', '#ffb0b0');
  }
  private enemyShot(enemy: PhantomEntity, angle: number, friendly = false): void {
    if (this.enemyShots.isFull()) return;
    const shot = this.physics.add.image(enemy.x, enemy.y, 'enemyBolt')
      .setDisplaySize(12, 12).setTint(enemy.variant === 'firework' ? 0xff8a5b : 0xb58aff);
    shot.setData('damage', enemy.shotDamage * (enemy.grudging ? 1.25 : 1));
    if (friendly) {
      shot.setData('friendly', Math.round(this.progression.state.attack * 1.8));
      shot.setData('born', this.time.now);
    }
    // Arcade groups apply default velocity on insertion. Launch afterwards.
    this.enemyShots.add(shot);
    const speed = enemy.variant === 'firework' ? 210 : 170;
    shot.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }
  private drawHeatRadius(): void {
    for (const enemy of this.enemies.getChildren() as PhantomEntity[]) if (enemy.active && enemy.charge > 0) this.warning.lineStyle(3, 0xffb0b0, 0.9).strokeCircle(enemy.x, enemy.y, 16 + enemy.charge * 8);
    if (this.stall > 180) this.warning.lineStyle(2, 0xffb0b0, Math.min(0.9, this.stall / 1000)).strokeCircle(this.player.x, this.player.y, Math.max(28, 280 - this.stall * 0.16));
    if (this.hover) this.warning.lineStyle(2, 0xb8fff4, 0.85).strokeCircle(this.player.x, this.player.y, 96); if (this.afterburn > 0 && this.heat < 70) this.warning.lineStyle(2, 0xffd0a8, 0.55).lineBetween(this.player.x - 80, this.player.y, this.player.x + 80, this.player.y);
    if (this.heat < 70) return;
    const alpha = this.overheated ? 0.9 : 0.45;
    this.warning.lineStyle(3, 0xffb0b0, alpha).strokeCircle(this.player.x, this.player.y, 270 + this.heat * 1.4);
  }

  private drawLock(): void {
    const mobs = (this.enemies.getChildren() as PhantomEntity[]).filter((enemy) => enemy.active && !enemy.isBoss);
    this.warning.lineStyle(2, 0xb7a4e8, 0.55);
    for (let i = 0; i < mobs.length; i += 1) for (let j = i + 1; j < mobs.length; j += 1) {
      if (Phaser.Math.Distance.Between(mobs[i].x, mobs[i].y, mobs[j].x, mobs[j].y) <= 90) this.warning.lineBetween(mobs[i].x, mobs[i].y, mobs[j].x, mobs[j].y);
    }
    for (const enemy of mobs) if (this.linkedNeighbors(enemy).length >= 2) {
      const broken = this.time.now < enemy.severedUntil;
      this.warning.fillStyle(broken ? 0xffb0b0 : enemy.cover > 0 ? 0xffd467 : 0xb7a4e8, 0.95).fillRect(enemy.x - 4, enemy.y - 4, 8, 8);
      if (!broken) for (let i = 0; i < enemy.cover; i += 1) this.warning.fillRect(enemy.x - 8 + i * 6, enemy.y - 12, 4, 3);
    }
    this.enemies.children.each((obj) => {
      const enemy = obj as PhantomEntity;
      if (!enemy.active || (!enemy.elite && !enemy.isBoss)) return true;
      const facing = enemy.flipX ? Math.PI : 0;
      this.warning.lineStyle(4, 0xd7ecff, 0.8).lineBetween(enemy.x, enemy.y, enemy.x + Math.cos(facing) * 28, enemy.y + Math.sin(facing) * 10);
      if (this.guarded(enemy)) this.warning.lineStyle(3, 0xb7a4e8, 0.9).strokeCircle(enemy.x, enemy.y, 34);
      return true;
    });
    const enemy = this.locked;
    if (!enemy?.active || enemy.health <= 0) return;
    const pulse = 18 + Math.sin(this.elapsed / 120) * 3;
    const armed = this.lockMark >= 2000; const angry = enemy.grudging; if (armed && !enemy.isBoss) this.warning.fillStyle(0xffd467, 0.9).fillCircle(enemy.x, enemy.y - 34, 4);
    this.warning.lineStyle(3, angry ? 0xff8d9a : armed ? 0xffd467 : 0xfff1c7, 0.95).strokeCircle(enemy.x, enemy.y, armed ? 28 : pulse); if (angry) this.warning.lineStyle(2, 0xff8d9a, 0.8).lineBetween(enemy.x, enemy.y, this.player.x, this.player.y);
    if (armed) {
      this.warning.lineStyle(2, 0xffd467, 0.45).strokeCircle(enemy.x, enemy.y, 150);
      const left = 2 - this.markTransfers;
      for (let i = 0; i < left; i += 1) this.warning.fillStyle(0xffd467, 0.95).fillRect(enemy.x - 10 + i * 8, enemy.y - 40, 5, 5);
    }
    this.warning.fillStyle(0xfff1c7, 0.95).fillRect(enemy.x - 8, enemy.y - pulse - 8, 16, 3);
  }

  private drawWarning(enemy: PhantomEntity): void { if (!enemy.abilityActive) return; const p = enemy.warningProgress; if (enemy.variant === 'creeper') this.warning.lineStyle(4, 0xffa32e, 0.85).strokeCircle(enemy.x, enemy.y, 40 + 80 * p); else if (enemy.variant === 'firework') { this.warning.lineStyle(3, 0xff8a5b, 0.75); for (let i = 0; i < 5; i += 1) { const a = (Math.PI * 2 * i) / 5; this.warning.lineBetween(enemy.x, enemy.y, enemy.x + Math.cos(a) * (30 + 70 * p), enemy.y + Math.sin(a) * (30 + 70 * p)); } } else if (enemy.variant === 'warden' || enemy.variant === 'phantom') this.warning.lineStyle(enemy.variant === 'warden' ? 8 : 3, enemy.variant === 'warden' ? 0x5cf1df : 0xffd467, 0.7).lineBetween(enemy.x, enemy.y, enemy.x + Math.cos(enemy.lockedAngle) * (enemy.variant === 'warden' ? 900 : 160), enemy.y + Math.sin(enemy.lockedAngle) * (enemy.variant === 'warden' ? 900 : 160)); else this.warning.lineStyle(4, enemy.variant === 'wither' ? 0xb58aff : 0xff5b5b, 0.8).lineBetween(enemy.x, enemy.y, enemy.x + Math.cos(enemy.lockedAngle) * 180, enemy.y + Math.sin(enemy.lockedAngle) * 180); }
  private updateHud(): void { this.hpBar.width = 176 * (this.player.health / this.player.maxHealth); this.xpBar.width = 176 * (this.progression.state.xp / this.progression.need()); this.levelText.setText(`LV ${this.progression.state.level}`); this.info.setText(`${Math.floor(this.elapsed / 60000)}:${String(Math.floor(this.elapsed / 1000) % 60).padStart(2, '0')}   击败 ${this.kills}${this.combo >= 2 ? `   连击 ${this.combo}${this.combo >= 3 ? ' [3]' : ''}` : this.comboBank > 0 ? `   钩爪追回 x${this.comboBank} ${Math.ceil(this.comboGrace / 1000)}s` : ''}`); this.statusText.setText(this.finalBossDefeated ? `末地核心已净化 · [R] 撤离结算 · ${this.economy.gems} ◆` : `${this.encounter.chapterLabel()} · ${this.economy.gems} ◆  ${this.economy.pendingUpgrades ? `[E] 附魔 x${this.economy.pendingUpgrades}` : '[E] 商店'}`); this.skillText.setText((this.skillClock > 0 ? `冲刺 ${Math.ceil(this.skillClock / 1000)}s` : '[空格] 末影冲刺' + (this.locked?.active ? (this.locked.grudging ? '  记仇' : this.keys.Q.isDown && this.strafing ? `  挑衅${Math.ceil(this.lockAge / 100) / 10}` : this.lockMark >= 2000 && !this.locked.isBoss ? '  标记[X]' : this.reelClock > 0 ? `  绷紧${Math.ceil(this.reelClock / 100) / 10}s` : '  锁定 [C]聚链') : '  [Q] 锁定')) + (this.surge > 0 ? `  爆发${Math.ceil(this.surge / 1000)}` : this.surgeStock > 0 ? `  锋利x${this.surgeStock}[1]` : '') + (this.focus > 0 ? `  急迫${Math.ceil(this.focus / 1000)}` : this.focusStock > 0 ? `  急迫x${this.focusStock}[2]` : '') + (this.grazeCharge > 0 ? `  擦弹${this.grazeCharge}${this.strafing ? '侧飞保留' : ' 直冲[Ctrl]'}` : '') + '  [V]弹反' + (this.economy.hooks > 0 ? `  钩${this.economy.hooks}${this.keys.SHIFT.isDown ? '甩' : '拉'}` : '' + (this.economy.apples > 0 ? `  苹果x${this.economy.apples}[G]` : '') + (this.remedy > 0 ? `  药+${this.remedy}${this.remedyLife > 0 ? (this.keys.N.isDown ? ' 改存' : ' [H]') + ' ' + Math.ceil(this.remedyLife / 1000) + 's' : ' 保险'}` : '') + (this.relicLife > 0 ? `  遗珠[1锋利/2急迫] ${Math.ceil(this.relicLife / 1000)}s` : '') + (this.breachLife > 0 ? `  突破[J扩散/K搜刮] ${Math.ceil(this.breachLife / 1000)}s` : '') + (this.chainLife > 0 ? `  侧击[U叠层/I变现] ${Math.ceil(this.chainLife / 1000)}s` : '') + (this.combo > 0 ? (this.keys.U.isDown ? '  按住保连' : '  连击在掉') : '') + (this.spiteLife > 0 ? `  记仇[O泄热/L变现] ${Math.ceil(this.spiteLife / 1000)}s` : '') + (this.whiffLife > 0 ? `  扑空[按住T] ${Math.ceil(this.whiffLife / 1000)}s` : '')) + (this.keys.Y.isDown ? '  主动散热' : '') + (this.keys.J.isDown ? '  按住射击' : '  [J]射击') + (this.keys.R.isDown && !this.finalBossDefeated ? '  牵引' : '') + (this.chainAim.size > 0 && this.keys.C.isDown ? '  按住齐射' : '') + (this.keys.C.isDown && this.strafing ? '  按住散开' : '') + (this.overheated ? (this.keys.SHIFT.isDown ? '  过热·憋引信' : '  过热') : this.heat >= 70 ? `  灼热${Math.ceil(this.heat)}` : `  热${Math.ceil(this.heat)}`) + (this.bossCore ? '  核心[4]' : '') + (this.keys.Z.isDown ? '  吸血' : '') + (this.keys.B.isDown && this.progression.state.magnet > 72 ? '  磁石' : '') + (this.keys.M.isDown ? '  修掩体' : '') + (this.stall >= 900 ? '  合围' : this.stall > 180 ? '  滞空' : '') + (this.strafing ? '  侧飞' : '  直飞') + (this.hover ? '  盘旋' : '') + (this.afterburn > 0 ? `  余热${Math.ceil(this.afterburn / 1000)}` : '')); if (this.boss?.active) { this.bossName.setText(NAMES[this.boss.variant] + (this.boss.phase >= 2 ? ' · 狂暴' : '')).setVisible(true); this.bossBar.setVisible(true).width = 280 * (this.boss.health / this.boss.maxHealth); } else { this.bossName.setVisible(false); this.bossBar.setVisible(false); } }
  private togglePause(): void { if (this.finished) return; this.paused = !this.paused; if (this.paused) { this.physics.pause(); this.showPause(); this.overlay?.setData('pause', true); } else { this.physics.resume(); this.overlay?.destroy(); } }
  private showPause(): void { this.overlay?.destroy(); this.overlay = this.add.container(0, 0).setDepth(20); this.overlay.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 400, 220, 0x19112d, 0.95).setStrokeStyle(3, 0xffd467)); const text = this.add.text(GAME_WIDTH / 2, 215, '已暂停', { color: '#ffe28a', fontSize: '32px', fontStyle: 'bold' }).setOrigin(0.5); const resume = this.add.text(GAME_WIDTH / 2, 282, '继续', { backgroundColor: '#9d355b', color: '#fff1c7', fontSize: '21px', padding: { x: 18, y: 9 } }).setOrigin(0.5).setInteractive({ useHandCursor: true }); resume.on('pointerdown', () => this.togglePause()); const save = this.save.load(); const sound = this.add.text(GAME_WIDTH / 2, 345, `音效：${save.sound ? '开' : '关'}`, { color: '#fff1c7', fontSize: '17px' }).setOrigin(0.5).setInteractive({ useHandCursor: true }); sound.on('pointerdown', () => { save.sound = !save.sound; this.save.save(save); sound.setText(`音效：${save.sound ? '开' : '关'}`); }); this.overlay.add([text, resume, sound]); }
  private dropPickup(x: number, y: number, kind: 'surge' | 'focus' | 'core' | 'relic' | 'loot', amount: number, loot?: { xp: number; gems: number; heal: number; stance: 'strafe' | 'rush' | 'still' }): void {
    if (this.pickups.isFull()) return;
    const color = kind === 'core' ? 0xff7a8a : kind === 'loot' ? 0x7dff63 : kind === 'relic' ? 0xe7d2ff : kind === 'surge' ? 0xffd467 : 0x7cf0ff;
    const pickup = this.physics.add.image(x, y, 'enemyBolt').setDisplaySize(16, 16).setTint(color).setDepth(7);
    pickup.setData('kind', kind); pickup.setData('amount', amount); pickup.setData('born', this.elapsed); if (loot) pickup.setData('loot', loot);
    this.pickups.add(pickup);
    pickup.setVelocity(Phaser.Math.Between(-30, 30), Phaser.Math.Between(-40, -10));
  }

  private pullPickups(): void {
    const pulling = this.keys.B.isDown && this.progression.state.magnet > 72;
    const magnet = pulling ? this.progression.state.magnet : 72;
    if (pulling) this.enemyShots.children.each((shotObj) => {
      const shot = shotObj as Phaser.Physics.Arcade.Image;
      if (!shot.active) return true;
      const shotDistance = Phaser.Math.Distance.Between(this.player.x, this.player.y, shot.x, shot.y);
      if (shotDistance > magnet || shotDistance < 30) return true;
      const shotAngle = Phaser.Math.Angle.Between(shot.x, shot.y, this.player.x, this.player.y);
      shot.setVelocity(Math.cos(shotAngle) * 150, Math.sin(shotAngle) * 150);
      return true;
    });
    this.pickups.children.each((obj) => {
      const pickup = obj as Phaser.Physics.Arcade.Image;
      if (!pickup.active) return true;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, pickup.x, pickup.y);
      const age = this.elapsed - Number(pickup.getData('born') ?? this.elapsed);
      const core = pickup.getData('kind') === 'core';
      if (age > (core ? 8000 : 12000)) { pickup.destroy(); return true; }
      pickup.setAlpha(core || age > 9000 ? 0.5 + Math.sin(age / 80) * 0.4 : 1);
      if (!core && age > 200) {
        const magnetRange = pulling ? this.progression.state.magnet : 58;
        if (distance < magnetRange) {
          const pullAngle = Phaser.Math.Angle.Between(pickup.x, pickup.y, this.player.x, this.player.y);
          pickup.setVelocity(Math.cos(pullAngle) * 260, Math.sin(pullAngle) * 260);
        } else {
          const velocity = pickup.body?.velocity;
          if (velocity && velocity.lengthSq() > 1) pickup.setVelocity(0, 0);
        }
      }
      if (core && age > 700) {
        const boss = (this.enemies.getChildren() as PhantomEntity[]).find((enemy) => enemy.active && enemy.isBoss);
        if (!boss) { pickup.destroy(); return true; }
        const home = Phaser.Math.Distance.Between(pickup.x, pickup.y, boss.x, boss.y);
        if (home < 28) {
          pickup.destroy();
          boss.enrage(2200);
          this.floatText(boss.x, boss.y - 28, '核心归位', '#ff7a8a');
          return true;
        }
        const toBoss = new Phaser.Math.Vector2(boss.x - pickup.x, boss.y - pickup.y);
        const angle = Math.atan2(toBoss.y, toBoss.x);
        pickup.setVelocity(Math.cos(angle) * 150, Math.sin(angle) * 150);
      }
      if (!core && distance < 38) {
        this.claimGroundLoot(pickup);
        return true;
      }
      if (pickup.y > GAME_HEIGHT + 36 || pickup.x < -48 || pickup.x > GAME_WIDTH + 48) pickup.destroy();
      return true;
    });
  }

  private claimGroundLoot(pickup: Phaser.Physics.Arcade.Image): void {
    if (!pickup.active) return;
    const kind = pickup.getData('kind') as 'surge' | 'focus' | 'core' | 'relic' | 'loot';
    const loot = pickup.getData('loot') as { xp: number; gems: number; heal: number; stance: 'strafe' | 'rush' | 'still' };
    pickup.destroy();
    if (kind === 'loot') {
      const levels = this.economy.grant(loot.xp, loot.gems, this.progression, loot.stance);
      this.player.maxHealth = this.progression.state.maxHealth;
      const heal = levels > 0 ? 25 : loot.heal;
      if (heal) this.offerRemedy(heal, this.player.x, this.player.y, levels > 0 ? '升级药' : '治疗');
      this.floatText(this.player.x, this.player.y - 22, `拾取 +${loot.gems} ◆`, '#7dff63');
      if (this.economy.pendingUpgrades && !this.paused) this.showUpgrade();
      return;
    }
    if (kind === 'relic') { this.offerRelic(); return; }
    if (kind === 'core') { this.bossCore = true; this.floatText(this.player.x, this.player.y - 22, '核心握持', '#ff7a8a'); return; }
    if (kind === 'surge') {
      this.surgeStock = Math.min(2, this.surgeStock + 1);
      this.floatText(this.player.x, this.player.y - 22, `锋利入库 ${this.surgeStock}  [1]`, '#ffd467');
      return;
    }
    this.focusStock = Math.min(2, this.focusStock + 1);
    this.floatText(this.player.x, this.player.y - 22, `急迫入库 ${this.focusStock}  [2]`, '#7cf0ff');
  }

  private offerRelic(): void {
    if (this.surgeStock >= 2 && this.focusStock >= 2) {
      this.floatText(this.player.x, this.player.y - 22, '附魔仓已满，遗珠碎了', '#ffb0b0');
      return;
    }
    this.relicLife = 2200;
    this.player.setData('relicX', this.player.x);
    this.player.setData('relicY', this.player.y);
    this.player.setData('relicHeading', this.lastHeading);
    this.floatText(this.player.x, this.player.y - 22, '遗珠 · 绕着它转再按 [1]/[2]', '#e7d2ff');
  }

  private claimRelic(kind: 'surge' | 'focus'): void {
    if (this.relicLife <= 0) return;
    if (kind === 'surge' && this.surgeStock >= 2) { this.floatText(this.player.x, this.player.y - 22, '锋利已满', '#ffb0b0'); return; }
    if (kind === 'focus' && this.focusStock >= 2) { this.floatText(this.player.x, this.player.y - 22, '急迫已满', '#ffb0b0'); return; }
    this.relicLife = 0;
    if (kind === 'surge') {
      this.surgeStock += 1;
      this.floatText(this.player.x, this.player.y - 22, `遗珠选锋利 ${this.surgeStock}`, '#ffd467');
      return;
    }
    this.focusStock += 1;
    this.floatText(this.player.x, this.player.y - 22, `遗珠选急迫 ${this.focusStock}`, '#7cf0ff');
  }

  private expireRelic(delta: number): void {
    if (this.relicLife <= 0) return;
    const relicX = Number(this.player.getData('relicX') ?? this.player.x);
    const relicY = Number(this.player.getData('relicY') ?? this.player.y);
    const orbit = Phaser.Math.Distance.Between(this.player.x, this.player.y, relicX, relicY);
    const flight = this.player.body?.velocity;
    const moving = !!flight && flight.lengthSq() > 400;
    const heading = moving ? Math.atan2(flight.y, flight.x) : Number(this.player.getData('relicHeading') ?? this.lastHeading);
    const turning = moving && Math.abs(Phaser.Math.Angle.Wrap(heading - Number(this.player.getData('relicHeading') ?? heading))) > 0.25;
    if (moving) this.player.setData('relicHeading', heading);
    const circling = orbit >= 48 && orbit <= 150 && turning;
    if (circling && this.player.getData('relicOrbit') !== 1) { this.player.setData('relicOrbit', 1); this.floatText(relicX, relicY - 16, '绕着遗珠转 · 选择还在', '#e7d2ff'); }
    else if (!circling && this.player.getData('relicOrbit') !== 2) { this.player.setData('relicOrbit', 2); this.floatText(this.player.x, this.player.y - 16, '没绕着转 · 遗珠在碎', '#ffb0b0'); }
    this.relicLife -= delta * (circling ? 0.35 : 2.2);
    if (this.relicLife > 0) return;
    this.player.setData('relicOrbit', 0);
    this.floatText(this.player.x, this.player.y - 22, '遗珠碎了', '#ffb0b0');
  }

  private offerRemedy(amount: number, x: number, y: number, label: string): void {
    if (this.keys.N.isDown) {
      this.remedy = Math.min(90, this.remedy + amount);
      this.remedyLife = 0;
      this.floatText(x, y - 16, `${label}存进保险 +${amount}`, '#ffe28a');
      return;
    }
    if (this.remedy > 0 && this.remedyLife <= 0) {
      this.floatText(x, y - 16, '保险已满，药没接住', '#ffb0b0');
      return;
    }
    this.remedy = amount;
    this.remedyLife = 2800;
    this.player.setData('remedyX', x);
    this.player.setData('remedyY', y);
    this.suckLoot(x, y + 8, 0xff5d6c, 1);
    this.floatText(x, y, `${label} +${amount} · [H] 或按住 N`, '#ff9292');
  }

  private useRemedy(): void {
    if (this.remedy <= 0 || this.remedyLife <= 0) {
      this.floatText(this.player.x, this.player.y - 24, this.remedy > 0 ? '保险要等下一章' : '没有现成的药', '#ffb0b0');
      return;
    }
    const heal = this.remedy;
    this.remedy = 0;
    this.remedyLife = 0;
    this.player.health = Math.min(this.player.maxHealth, this.player.health + heal);
    this.heat = Math.min(100, this.heat + 16);
    if (this.heat >= 100 && !this.overheated) { this.overheated = true; this.floatText(this.player.x, this.player.y - 40, '包扎过热', '#ffb0b0'); }
    this.floatText(this.player.x, this.player.y - 24, `当场包扎 +${heal}`, '#baffb0');
  }

  private expireRemedy(delta: number): void {
    if (this.remedy <= 0 || this.remedyLife <= 0) return;
    if (this.keys.N.isDown) {
      this.remedyLife = 0;
      this.floatText(this.player.x, this.player.y - 24, `药改存保险 +${this.remedy}`, '#ffe28a');
      return;
    }
    const near = Phaser.Math.Distance.Between(this.player.x, this.player.y, Number(this.player.getData('remedyX') ?? this.player.x), Number(this.player.getData('remedyY') ?? this.player.y)) <= 64;
    if (near && this.player.getData('remedyStay') !== 1) { this.player.setData('remedyStay', 1); this.floatText(this.player.x, this.player.y - 18, '停在药边 · 还能包', '#baffb0'); }
    else if (!near && this.player.getData('remedyStay') !== 2) { this.player.setData('remedyStay', 2); this.floatText(this.player.x, this.player.y - 18, '离开药边 · 药在洒', '#ffb0b0'); }
    this.remedyLife -= delta * (near ? 0.4 : 2.3);
    if (this.remedyLife > 0) return;
    this.player.setData('remedyStay', 0);
    this.floatText(this.player.x, this.player.y - 24, '药洒了', '#ffb0b0');
    this.remedy = 0;
  }

  private eatApple(): void {
    if (this.economy.apples <= 0 || this.player.health >= this.player.maxHealth && this.heat <= 0) return;
    const centered = Phaser.Math.Distance.Between(this.player.x, this.player.y, GAME_WIDTH / 2, GAME_HEIGHT / 2) <= 120;
    this.economy.apples -= 1;
    if (!centered) {
      this.heat = Math.min(100, this.heat + 30);
      if (this.heat >= 100) this.overheated = true;
      const bite = Math.max(8, Math.round(this.player.maxHealth * 0.08));
      this.hurtPlayer(bite);
      this.floatText(this.player.x, this.player.y - 24, `没回中心 · 苹果烧喉 -${bite}`, '#ffb0b0');
      return;
    }
    const heal = Math.round(this.player.maxHealth * 0.5);
    this.player.health = Math.min(this.player.maxHealth, this.player.health + heal);
    this.heat = 0;
    this.overheated = false;
    this.floatText(this.player.x, this.player.y - 24, `中心吃下 +${heal} · 热量清零`, '#ffe28a');
  }

  private slamCore(): void {
    if (!this.bossCore) return;
    const enemy = this.locked;
    if (!enemy?.active || enemy.health <= 0) {
      this.floatText(this.player.x, this.player.y - 24, '先锁定再砸核心', '#ff7a8a');
      return;
    }
    this.bossCore = false;
    this.coreClock = 0;
    const flight = this.player.body?.velocity;
    const downward = !!flight && flight.y > 60;
    const above = this.player.y <= enemy.y - 50;
    const slammed = above && downward;
    if (slammed) {
      if (enemy.isBoss) enemy.cancelCast(1400);
      else enemy.exposedUntil = Math.max(enemy.exposedUntil, this.time.now + 1200);
      this.hitEnemy(enemy, this.progression.state.attack * 4);
      this.floatText(enemy.x, enemy.y - 28, enemy.isBoss ? '高空俯冲 · 核心重砸' : '俯冲下砸 · 核心重砸', '#ff7a8a');
    } else {
      const recoil = Math.max(6, Math.round(this.progression.state.attack * 0.3));
      this.hurtPlayer(recoil);
      this.hitEnemy(enemy, this.progression.state.attack * 1.2);
      this.player.setPosition(Phaser.Math.Clamp(this.player.x, 28, GAME_WIDTH - 28), Phaser.Math.Clamp(this.player.y - 48, 78, GAME_HEIGHT - 28));
      this.floatText(enemy.x, enemy.y - 28, '没从上方下冲 · 核心反震', '#ffb0b0');
    }
  }

  private cashCombo(): void {
    const enemy = this.locked;
    if (!enemy?.active || enemy.health <= 0 || this.combo < 3) {
      this.floatText(this.player.x, this.player.y - 24, this.combo < 3 ? '连击不够' : '先锁定目标', '#ffb0b0');
      return;
    }
    const spent = this.combo;
    const close = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) <= 78;
    this.combo = 0;
    this.comboClock = 0;
    this.heat = Math.min(100, this.heat + spent * (close ? 8 : 14));
    if (this.heat >= 100) this.overheated = true;
    if (!close) {
      const away = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      this.player.setPosition(Phaser.Math.Clamp(this.player.x + Math.cos(away) * 64, 28, GAME_WIDTH - 28), Phaser.Math.Clamp(this.player.y + Math.sin(away) * 64, 78, GAME_HEIGHT - 28));
      this.floatText(enemy.x, enemy.y - 36, `离太远 · 连击震散 x${spent}`, '#ffb0b0');
      return;
    }
    this.hitEnemy(enemy, this.progression.state.attack * spent * 0.85);
    this.floatText(enemy.x, enemy.y - 36, `贴身打进 x${spent}`, '#ffe28a');
  }

  private crackBuff(kind: 'surge' | 'focus'): void {
    const enemy = this.locked;
    const facing = enemy?.active ? (enemy.flipX ? Math.PI : 0) : 0;
    const toPlayer = enemy?.active ? Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y) : 0;
    const behind = !!enemy?.active && Math.abs(Phaser.Math.Angle.Wrap(toPlayer - facing - Math.PI)) <= 0.9;
    const distance = enemy?.active ? Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y) : 0;
    if (!(behind && distance >= 70 && distance <= 190)) {
      this.heat = Math.min(100, this.heat + 18);
      if (this.heat >= 100 && !this.overheated) { this.overheated = true; this.floatText(this.player.x, this.player.y - 40, '开附魔过热', '#ffb0b0'); }
      this.floatText(this.player.x, this.player.y - 24, enemy?.active ? '没拉开到背后 · 附魔没开' : '先锁定再开附魔', '#ffb0b0');
      return;
    }
    if (kind === 'surge') {
      if (this.surgeStock <= 0 || this.surge > 0) return;
      this.surgeStock -= 1;
      this.surge = 5000;
      this.heat = Math.min(100, this.heat + 35);
      if (this.heat >= 100) { this.overheated = true; this.floatText(this.player.x, this.player.y - 40, '锋利过热', '#ffb0b0'); }
      if (this.focus > 0) { this.focus = 0; this.floatText(this.player.x, this.player.y - 56, '急迫被顶掉', '#7cf0ff'); }
      this.floatText(this.player.x, this.player.y - 22, '开锋 5s', '#ffd467');
      return;
    }
    if (this.focusStock <= 0 || this.focus > 0) return;
    this.focusStock -= 1;
    this.focus = 5000;
    const bite = Math.max(8, Math.round(this.player.maxHealth * 0.08));
    this.hurtPlayer(bite);
    if (this.surge > 0) { this.surge = 0; this.floatText(this.player.x, this.player.y - 56, '锋利被顶掉', '#ffd467'); }
    this.floatText(this.player.x, this.player.y - 22, `急迫 5s -${bite}`, '#7cf0ff');
  }

  private end(win: boolean): void { if (this.finished) return; this.finished = true; this.physics.pause(); this.player.setVelocity(0, 0); const old = this.save.load(); this.save.save({ bestLevel: Math.max(old.bestLevel, this.progression.state.level), bestKills: Math.max(old.bestKills, this.kills), sound: old.sound }); this.overlay?.destroy(); this.overlay = this.add.container(0, 0).setDepth(20); this.overlay.add(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 470, 220, 0x19112d, 0.96).setStrokeStyle(3, 0xffd467)); this.overlay.add(this.add.text(GAME_WIDTH / 2, 220, win ? '末地制霸' : '飞行器损毁', { color: '#ffe28a', fontSize: '34px', fontStyle: 'bold' }).setOrigin(0.5)); this.overlay.add(this.add.text(GAME_WIDTH / 2, 270, `LV ${this.progression.state.level}　击败 ${this.kills}`, { color: '#fff1c7', fontSize: '18px' }).setOrigin(0.5)); const retry = this.add.text(GAME_WIDTH / 2, 335, '重新试飞', { backgroundColor: '#9d355b', color: '#fff1c7', fontSize: '21px', padding: { x: 20, y: 10 } }).setOrigin(0.5).setInteractive({ useHandCursor: true }); retry.on('pointerdown', () => this.scene.restart()); this.overlay.add(retry); }
}
