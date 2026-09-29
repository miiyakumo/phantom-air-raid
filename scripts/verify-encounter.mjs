import assert from 'node:assert/strict';
import { CHAPTERS } from '../src/data/enemy-recipes';
import { EncounterSystem } from '../src/systems/EncounterSystem';

assert.equal(CHAPTERS.length, 5);
assert.deepEqual(CHAPTERS[0].mobPool, ['phantom']);
assert.deepEqual(CHAPTERS[1].mobPool, ['phantom', 'rider']);
assert.deepEqual(CHAPTERS[4].mobPool, ['phantom', 'rider', 'creeper', 'firework', 'wither']);
assert.equal(CHAPTERS[0].boss, 'rider');
assert.equal(CHAPTERS[4].boss, 'warden');
assert.ok(CHAPTERS.every((chapter) => chapter.bossAfterMs === 45000 && chapter.bossAfterKills === 12));
assert.ok(CHAPTERS[4].eliteChance <= 0.2);

const encounter = new EncounterSystem();
assert.equal(encounter.shouldSpawnBoss(), false);
encounter.addTime(44999);
assert.equal(encounter.shouldSpawnBoss(), false);
for (let i = 0; i < 11; i += 1) encounter.onKill(false);
assert.equal(encounter.shouldSpawnBoss(), false);
encounter.onKill(false);
assert.equal(encounter.shouldSpawnBoss(), true);
assert.equal(encounter.bossVariant(), 'rider');

const timed = new EncounterSystem();
timed.addTime(45000);
assert.equal(timed.shouldSpawnBoss(), true);
timed.onBossSpawned();
assert.equal(timed.shouldSpawnBoss(), false);
timed.addTime(99999);
assert.equal(timed.bossAlive, true);

const pools = [];
const run = new EncounterSystem();
let n = 0;
const seq = [0.1, 0.99, 0.1, 0.01];
const rng = () => seq[n++ % seq.length];
assert.deepEqual(run.nextSpawn(rng), { variant: 'phantom', elite: false });
assert.deepEqual(run.nextSpawn(rng), { variant: 'phantom', elite: true });

for (const expected of ['rider', 'creeper', 'firework', 'wither', 'warden']) {
  run.onBossSpawned();
  assert.equal(run.bossVariant(), expected);
  const result = run.onBossDefeated();
  pools.push(result.chapterIndex);
}
assert.deepEqual(pools, [1, 2, 3, 4, 5]);
assert.equal(run.finished, true);
assert.equal(run.shouldSpawnBoss(), false);
assert.equal(run.bossVariant(), null);

const demoted = new EncounterSystem();
demoted.onBossSpawned();
demoted.onBossDefeated();
const seen = new Set();
for (let i = 0; i < 40; i += 1) seen.add(demoted.nextSpawn(() => (i % 2) / 2).variant);
// deterministic: variant roll then elite roll. Use open interval samples.
const variants = new Set();
for (let i = 0; i < 20; i += 1) {
  const pick = demoted.nextSpawn(() => i / 20);
  variants.add(pick.variant);
}
assert.ok(variants.has('phantom') && variants.has('rider'), [...variants].join(','));


const waves = new EncounterSystem();
waves.addTime(13999);
assert.equal(waves.takeWave('hold'), null);
waves.addTime(1);
assert.equal(waves.takeWave('hold').kind, 'pincer');
assert.equal(waves.takeWave('strafe'), null);
waves.addTime(16000);
assert.equal(waves.takeWave('rush').kind, 'dive-lane');
waves.onBossSpawned();
waves.addTime(20000);
assert.equal(waves.takeWave(), null);

const late = new EncounterSystem();
for (let chapter = 0; chapter < 5; chapter += 1) {
  if (chapter > 0) { late.onBossSpawned(); late.onBossDefeated(); }
  late.addTime(14000);
}
assert.equal(late.takeWave('hold').kind, 'pincer');
late.addTime(16000);
assert.equal(late.takeWave('rush').kind, 'dive-lane');
late.addTime(16000);
assert.equal(late.takeWave('strafe').kind, 'creeper-ring');
late.addTime(16000);
assert.equal(late.takeWave('strafe').kind, 'creeper-ring');
console.log('Encounter checks passed: demoted bosses join later pools; bosses trigger on 45s or 12 kills.');
