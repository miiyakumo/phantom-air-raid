import Phaser from 'phaser';
import type { PlayerEntity } from '../entities/PlayerEntity';
import type { PhantomEntity, PhantomVariant } from '../entities/PhantomEntity';
import type { EncounterSystem } from '../systems/EncounterSystem';
import type { EconomySystem } from '../systems/EconomySystem';
import type { ProgressionSystem } from '../systems/ProgressionSystem';
import { ProjectileEntity } from '../entities/ProjectileEntity';

// Keep access to implementation details in this development-only adapter.
interface InspectableBattle extends Phaser.Scene {
  player?: PlayerEntity;
  enemies: Phaser.Physics.Arcade.Group;
  shots: Phaser.Physics.Arcade.Group;
  enemyShots: Phaser.Physics.Arcade.Group;
  pickups: Phaser.Physics.Arcade.Group;
  progression: ProgressionSystem;
  economy: EconomySystem;
  encounter: EncounterSystem;
  overlay?: Phaser.GameObjects.Container;
  elapsed: number;
  paused: boolean;
  finished: boolean;
  kills: number;
  volleyId: number;
  heat: number;
  overheated: boolean;
  stall: number;
  skillClock: number;
  spawnClock: number;
  boss?: PhantomEntity;
  spawnEnemy(x: number, y: number, variant: PhantomVariant, boss?: boolean, elite?: boolean): PhantomEntity;
  enemyShot(enemy: PhantomEntity, angle: number, friendly?: boolean): void;
}

export function seedRandom(seed: string): void {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  Math.random = () => {
    state |= 0;
    state = state + 0x6D2B79F5 | 0;
    let n = Math.imul(state ^ state >>> 15, 1 | state);
    n = n + Math.imul(n ^ n >>> 7, 61 | n) ^ n;
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
  Phaser.Math.RND?.sow([seed]);
}

export function installDebug(game: Phaser.Game): void {
  const params = new URLSearchParams(location.search);
  const seed = params.get('seed') ?? '1';
  const manual = params.has('manual');
  const delta = 1000 / 60;
  let frame = 0;
  let ready = false;
  let fixture: string | null = null;
  const battle = () => game.scene.getScene('Battle') as unknown as InspectableBattle;
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const bodyState = (obj: Phaser.Physics.Arcade.Sprite | Phaser.Physics.Arcade.Image) => ({
    x: round(obj.x), y: round(obj.y),
    vx: round(obj.body?.velocity.x ?? 0), vy: round(obj.body?.velocity.y ?? 0),
    bodyEnabled: obj.body?.enable ?? false,
  });
  const texts = (root: Phaser.GameObjects.GameObject[]): object[] => root.flatMap((obj): object[] => {
    if (!obj.active || !('visible' in obj) || !obj.visible) return [];
    if (obj instanceof Phaser.GameObjects.Container) return texts(obj.list);
    if (!(obj instanceof Phaser.GameObjects.Text)) return [];
    const bounds = obj.getBounds();
    return [{ text: obj.text, x: round(bounds.x), y: round(bounds.y), width: round(bounds.width),
      height: round(bounds.height), interactive: !!obj.input?.enabled }];
  });
  const getState = () => {
    const scene = game.scene.getScenes(true).at(-1);
    const base = { version: 1, seed, manual, ready, frame, fixture, scene: scene?.scene.key ?? null,
      viewport: { width: game.scale.width, height: game.scale.height },
      texts: scene ? texts(scene.children.list) : [] };
    const b = battle();
    if (scene?.scene.key !== 'Battle' || !b.player) return base;
    const enemies = (b.enemies.getChildren() as PhantomEntity[]).filter(e => e.active).map(e => ({
      ...bodyState(e), variant: e.variant, boss: e.isBoss, elite: e.elite,
      hp: round(e.health), maxHp: e.maxHealth, phase: e.phase, flankStacks: e.flankStacks,
      ability: e.abilityActive, abilityElapsed: round(e.abilityElapsed),
    }));
    const shots = (group: Phaser.Physics.Arcade.Group) =>
      (group.getChildren() as Phaser.Physics.Arcade.Image[]).filter(s => s.active).map(s => ({
        ...bodyState(s), damage: round(Number(s.getData('damage') ?? 0)),
        friendly: Number(s.getData('friendly') ?? 0),
      }));
    return { ...base, elapsedMs: round(b.elapsed), paused: b.paused, finished: b.finished,
      player: { ...bodyState(b.player), hp: round(b.player.health), maxHp: b.player.maxHealth },
      progression: { ...b.progression.state },
      economy: { gems: b.economy.gems, pendingUpgrades: b.economy.pendingUpgrades,
        hooks: b.economy.hooks, apples: b.economy.apples },
      chapter: { index: b.encounter.chapterIndex, elapsedMs: round(b.encounter.elapsedThisChapter),
        kills: b.encounter.killsThisChapter, bossAlive: b.encounter.bossAlive, finished: b.encounter.finished },
      kills: b.kills, volleys: b.volleyId, heat: round(b.heat), overheated: b.overheated,
      stallMs: round(b.stall), dashCooldownMs: round(b.skillClock), enemies,
      shots: shots(b.shots), enemyShots: shots(b.enemyShots),
      pickups: b.pickups.countActive(),
      panel: b.overlay?.active ? texts(b.overlay.list) : [],
      listeners: Object.fromEntries(b.events.eventNames().map(name => [String(name), b.events.listenerCount(name)])),
    };
  };
  const step = (frames = 1) => {
    if (!manual || !ready) throw new Error('step requires a ready ?debug&manual session');
    if (!Number.isInteger(frames) || frames < 1 || frames > 600) throw new Error('frames must be 1..600');
    const wallNow = Date.now;
    try {
      // Phaser tweens use Date.now while physics/clocks use the supplied delta.
      // Advance both clocks together so fast stepping also expires visual effects.
      Date.now = () => 1700000000000 + frame * delta;
      for (let i = 0; i < frames; i++) {
        frame++;
        game.loop.now = frame * delta;
        game.loop.time = frame * delta;
        game.step(frame * delta, delta);
      }
    } finally { Date.now = wallNow; }
    return getState();
  };
  const loadFixture = (name: 'enemy-projectile' | 'shop' | 'defeat' | 'shield-front' | 'shield-back') => {
    if (!ready || game.scene.getScenes(true).at(-1)?.scene.key !== 'Battle') throw new Error('Enter Battle first');
    const b = battle();
    fixture = name;
    if (name === 'shop') b.economy.gems = 200;
    else if (name === 'defeat') b.player!.health = 0;
    else if (name === 'shield-front' || name === 'shield-back') {
      b.enemies.clear(true, true);
      b.shots.clear(true, true);
      b.spawnClock = 1e9;
      const enemy = b.spawnEnemy(480, 250, 'rider', false, true);
      enemy.setFlipX(false);
      const angle = name === 'shield-front' ? Math.PI : 0;
      const shot = new ProjectileEntity(b, 480, 250, angle);
      shot.setData('damage', 1);
      b.shots.add(shot);
      shot.launch(angle);
    }
    else if (name === 'enemy-projectile') {
      b.enemies.clear(true, true);
      b.shots.clear(true, true);
      b.enemyShots.clear(true, true);
      b.spawnClock = 1e9;
      b.player!.setPosition(480, 400);
      const enemy = b.spawnEnemy(480, 180, 'wither');
      b.enemyShot(enemy, Math.PI / 2);
      enemy.destroy();
    } else throw new Error(`Unknown fixture: ${name}`);
    return getState();
  };
  const api = { getState, step, loadFixture };
  (window as unknown as { __gameDebug: typeof api }).__gameDebug = api;
  const onRender = () => {
    if (!game.scene.isActive('Menu')) return;
    if (manual) {
      game.loop.stop();
      game.loop.now = 0;
      game.loop.time = 0;
      // The whole manual session uses one virtual clock, including scene creation
      // triggered immediately by a DOM event between two calls to step().
      Date.now = () => 1700000000000 + frame * delta;
    }
    seedRandom(seed);
    ready = true;
    game.events.off(Phaser.Core.Events.POST_RENDER, onRender);
  };
  game.events.on(Phaser.Core.Events.POST_RENDER, onRender);
}
