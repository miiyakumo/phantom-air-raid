import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = fs.readFileSync(new URL('../src/data/game-config.ts', import.meta.url), 'utf8');
const economy = fs.readFileSync(new URL('../src/systems/EconomySystem.ts', import.meta.url), 'utf8');
const battle = fs.readFileSync(new URL('../src/scenes/BattleScene.ts', import.meta.url), 'utf8');

assert.match(config, /normal: \{ xp: 1, gems: 2, healChance: 0\.06, healAmount: 12 \}/);
assert.match(config, /elite: \{ xp: 3, gems: 5, healChance: 0\.06, healAmount: 12 \}/);
assert.match(config, /boss: \{ xp: 35, gems: 100, healChance: 0, healAmount: 0 \}/);
assert.match(config, /speedCap: 340/);
assert.match(economy, /this\.gems -= offer\.price/);
assert.match(economy, /speed >= ECONOMY\.shop\.speedCap/);
assert.match(battle, /economy\.grant\(/);
assert.match(battle, /economy\.preview\(wasBoss \? 'boss' : wasElite \? 'elite' : 'normal'/);
assert.doesNotMatch(battle, /this\.gems|this\.purchases|this\.pendingUpgrades/);
assert.match(battle, /economy\.purchase\(id, this\.progression\.state\)/);
console.log('Economy checks passed: rewards, shop caps and battle wiring are explicit.');
