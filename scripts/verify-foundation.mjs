import assert from 'node:assert/strict';
import { ProgressionSystem } from '../src/systems/ProgressionSystem';
import { EconomySystem } from '../src/systems/EconomySystem';
import { EncounterSystem } from '../src/systems/EncounterSystem';
import { CastHits, volleyPattern, pointSegmentDistance } from '../src/systems/CombatRules';
import { SaveSystem } from '../src/systems/SaveSystem';

const results = [];
function check(name, fn) { fn(); results.push(name); console.log(`PASS ${name}`); }
check('growth-never-reduces-basic-output', () => {
  for (const stance of ['still', 'rush', 'strafe']) {
    const p = new ProgressionSystem();
    for (let i = 0; i < 30; i++) {
      const before = { ...p.state };
      p.addExperience(p.need(), stance);
      assert.ok(p.state.attack >= before.attack);
      assert.ok(p.state.fireInterval <= before.fireInterval);
      assert.ok(p.state.attack / p.state.fireInterval >= before.attack / before.fireInterval);
      assert.ok(p.state.maxHealth >= before.maxHealth);
      assert.ok(p.state.projectileCount >= before.projectileCount);
    }
  }
});
check('stance-cannot-secretly-change-growth', () => {
  const states = ['still', 'rush', 'strafe'].map(stance => { const p = new ProgressionSystem(); p.addExperience(200, stance); return p.state; });
  assert.deepEqual(states[0], states[1]); assert.deepEqual(states[1], states[2]);
});
check('leveling-keeps-haste-upgrades', () => {
  const p = new ProgressionSystem(), e = new EconomySystem();
  for (let i = 0; i < 20; i++) e.applyEnchant('haste', p.state);
  const before = p.state.fireInterval;
  p.addExperience(p.need()); assert.ok(p.state.fireInterval <= before);
});
check('every-volley-preserves-full-strength-center', () => {
  for (let count = 1; count <= 4; count++) for (let volley = 0; volley < 4; volley++) {
    const lanes = volleyPattern(count, volley);
    assert.equal(lanes.length, count); assert.deepEqual(lanes[0], { offset: 0, multiplier: 1 });
    assert.ok(lanes.every(lane => lane.multiplier > 0));
  }
});
check('upgrade-candidates-persist-and-are-copy-safe', () => {
  const e = new EconomySystem(); e.pendingUpgrades = 2;
  const offers = e.rollOffers(() => 0.17);
  assert.equal(new Set(offers.map(o => o.id)).size, 3);
  for (let i = 0; i < 20; i++) assert.deepEqual(e.rollOffers(() => 0.99), offers);
  const leaked = e.rollOffers(); leaked[0].label = 'changed'; leaked.pop();
  assert.deepEqual(e.rollOffers(), offers);
  e.consumeUpgrade(); assert.equal(e.pendingUpgrades, 1);
  assert.notDeepEqual(e.rollOffers(() => 0.99), offers);
  e.reset(); assert.equal(e.pendingUpgrades, 0); assert.equal(e.gems, 0);
});
check('purchases-cap-inventory-without-charging', () => {
  const e = new EconomySystem(), p = new ProgressionSystem(); e.gems = 1000;
  for (const id of ['hook', 'golden-apple']) {
    for (let i = 0; i < 3; i++) assert.equal(e.purchase(id, p.state).ok, true);
    const before = e.gems; assert.equal(e.purchase(id, p.state).ok, false); assert.equal(e.gems, before);
  }
  p.state.speed = 340; const before = e.gems;
  assert.equal(e.purchase('swiftness-boots', p.state).ok, false); assert.equal(e.gems, before);
});
check('invalid-rewards-do-not-partially-mutate-economy', () => {
  const e = new EconomySystem(), p = new ProgressionSystem();
  for (const value of [-1, Infinity, NaN]) {
    assert.throws(() => e.grant(value, 2, p)); assert.equal(e.gems, 0); assert.equal(p.state.xp, 0);
    assert.throws(() => e.grant(1, value, p)); assert.equal(e.gems, 0); assert.equal(p.state.xp, 0);
  }
});
check('casts-hit-once-at-30-60-120-hz', () => {
  for (const hz of [30, 60, 120]) {
    const hits = new CastHits(), player = {}; let health = 100;
    for (let i = 0; i < hz; i++) if (!hits.has(player)) { health -= 16; hits.mark(player); }
    assert.equal(health, 84); hits.reset(); assert.equal(hits.has(player), false);
  }
});
check('laser-distance-handles-ends-and-zero-length', () => {
  assert.equal(pointSegmentDistance(20, 10, 0, 0, 100, 0), 10);
  assert.equal(pointSegmentDistance(-20, 0, 0, 0, 100, 0), 20);
  assert.equal(pointSegmentDistance(3, 4, 0, 0, 0, 0), 5);
});
check('boss-defeat-is-idempotent-and-ends-after-five', () => {
  const e = new EncounterSystem(); assert.equal(e.onBossDefeated().advanced, false);
  for (let i = 0; i < 5; i++) {
    e.onBossSpawned(); assert.equal(e.onBossDefeated().chapterIndex, i + 1);
    assert.equal(e.onBossDefeated().advanced, false); assert.equal(e.chapterIndex, i + 1);
  }
  assert.equal(e.finished, true); assert.equal(e.bossVariant(), null); assert.equal(e.shouldSpawnBoss(), false);
});
check('waves-rotate-and-do-not-spawn-future-bosses', () => {
  const e = new EncounterSystem();
  for (let chapter = 0; chapter < 5; chapter++) {
    const names = [];
    for (let i = 0; i < 6; i++) { e.addTime(16000); names.push(e.takeWave().kind); }
    assert.ok(names.includes('pincer') && names.includes('dive-lane'));
    if (chapter < 2) assert.ok(!names.includes('creeper-ring'));
    if (chapter < 4) assert.ok(!names.includes('wither-line'));
    e.onBossSpawned(); e.onBossDefeated();
  }
});
check('blocked-or-corrupt-storage-does-not-break-results', () => {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } } });
    const save = new SaveSystem(); assert.equal(save.load().bestLevel, 1); assert.doesNotThrow(() => save.save({ bestLevel: 2, bestKills: 3, sound: true }));
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem() { return '{"bestLevel":"bad","bestKills":-10}'; } } });
    assert.deepEqual(save.load(), { bestLevel: 1, bestKills: 0, sound: true });
  } finally { if (before) Object.defineProperty(globalThis, 'localStorage', before); else delete globalThis.localStorage; }
});
console.log(`${results.length}/${results.length} combat foundation checks passed.`);
