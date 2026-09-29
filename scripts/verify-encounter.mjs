import assert from 'node:assert/strict';
import { CHAPTERS } from '../src/data/enemy-recipes';
import { EncounterSystem } from '../src/systems/EncounterSystem';

assert.equal(CHAPTERS.length, 5);
assert.deepEqual(CHAPTERS[0].mobPool, ['phantom']);
assert.deepEqual(CHAPTERS[1].mobPool, ['phantom', 'rider']);
assert.deepEqual(CHAPTERS[4].mobPool, ['phantom', 'rider', 'creeper', 'firework', 'wither']);
assert.ok(CHAPTERS.every(chapter => chapter.bossAfterMs === 45000 && chapter.bossAfterKills === 12));
assert.ok(CHAPTERS[4].eliteChance <= 0.2);
const encounter = new EncounterSystem();
encounter.addTime(44999);
for (let i = 0; i < 11; i++) encounter.onKill(false);
assert.equal(encounter.shouldSpawnBoss(), false);
encounter.onKill(false);
assert.equal(encounter.shouldSpawnBoss(), true);
assert.equal(encounter.bossVariant(), 'rider');
const timed = new EncounterSystem();
timed.addTime(45000); assert.equal(timed.shouldSpawnBoss(), true);
timed.onBossSpawned(); assert.equal(timed.shouldSpawnBoss(), false);
const elapsed = timed.elapsedThisChapter;
timed.addTime(99999); assert.equal(timed.elapsedThisChapter, elapsed);
let cursor = 0;
const sequence = [0.1, 0.99, 0.1, 0.01];
const rng = () => sequence[cursor++ % sequence.length];
assert.deepEqual(encounter.nextSpawn(rng), { variant: 'phantom', elite: false });
assert.deepEqual(encounter.nextSpawn(rng), { variant: 'phantom', elite: true });
const run = new EncounterSystem();
for (const [index, expected] of ['rider', 'creeper', 'firework', 'wither', 'warden'].entries()) {
  assert.equal(run.bossVariant(), expected); run.onBossSpawned();
  assert.equal(run.onBossDefeated().chapterIndex, index + 1);
}
assert.equal(run.finished, true); assert.equal(run.shouldSpawnBoss(), false); assert.equal(run.bossVariant(), null);
const demoted = new EncounterSystem(); demoted.onBossSpawned(); demoted.onBossDefeated();
const variants = new Set();
for (let i = 0; i < 20; i++) variants.add(demoted.nextSpawn(() => i / 20).variant);
assert.ok(variants.has('phantom') && variants.has('rider'));
const waves = new EncounterSystem(); waves.addTime(13999); assert.equal(waves.takeWave(), null);
waves.addTime(1); assert.equal(waves.takeWave('hold').kind, 'pincer'); assert.equal(waves.takeWave(), null);
waves.addTime(16000); assert.equal(waves.takeWave('rush').kind, 'dive-lane');
waves.onBossSpawned(); waves.addTime(20000); assert.equal(waves.takeWave(), null);
const late = new EncounterSystem();
for (let i = 0; i < 4; i++) { late.onBossSpawned(); late.onBossDefeated(); }
const expected = ['pincer', 'dive-lane', 'creeper-ring', 'wither-line', 'pincer'];
for (const kind of expected) { late.addTime(16000); assert.equal(late.takeWave('strafe').kind, kind); }
console.log('Encounter checks passed: chapter thresholds, demotion pools, terminal state and rotating waves.');
