import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/entities/PhantomEntity.ts', import.meta.url), 'utf8');
function table(name) {
  const match = source.match(new RegExp(`const ${name}[^=]*= \\{([^}]+)\\}`));
  assert.ok(match, `Missing ${name} balance table`);
  return Object.fromEntries([...match[1].matchAll(/(\w+):\s*(\d+)/g)].map(([, key, value]) => [key, Number(value)]));
}
const ordinary = table('BASE_HP');
assert.deepEqual(Object.values(ordinary), [30, 45, 60, 80, 100, 125]);
assert.match(source, /BOSS_MULT = 16/);
assert.match(source, /isBoss \? scaled \* BOSS_MULT : scaled/);

const rows = Object.entries(ordinary).map(([variant, base], stage) => {
  const health = Math.round(base * (1 + stage * 0.45));
  const eliteHealth = Math.round(base * 1.8 * (1 + stage * 0.45));
  const bossHealth = health * 16;
  assert.ok(health < 500, `${variant}: ordinary health is no longer a short kill`);
  assert.ok(bossHealth / eliteHealth >= 8 && bossHealth / eliteHealth <= 20, `${variant}: boss/elite ratio left the 8-20 band`);
  return { stage, variant, ordinaryHP: health, eliteHP: eliteHealth, bossHP: bossHealth };
});
console.table(rows);
console.log('Balance checks passed: bosses are a short multiple of same-stage mobs.');
