import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { openGame, root } from './lib/game-browser.mjs';

const { values } = parseArgs({ options: { output: { type: 'string', default: 'output/gameplay-checks/latest' } } });
const output = path.resolve(root, values.output), results = [];
await mkdir(output, { recursive: true });
async function check(name, run, options = {}) {
  let game;
  try {
    game = await openGame({ ...options, output: path.join(output, name) });
    if (options.manual === false) {
      await game.page.keyboard.press('Enter');
      await game.page.waitForFunction(() => window.__gameDebug.getState().scene === 'Battle');
    } else {
      await game.act({ keys: ['Enter'], frames: 1 });
      await game.act({ keys: [], frames: 1 });
    }
    const evidence = await run(game);
    assert.deepEqual(game.errors, [], 'No browser or frame errors');
    results.push({ name, passed: true, evidence });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
    console.log(`FAIL ${name}: ${error.message.split('\n')[0]}`);
  } finally {
    if (game) { await game.capture('final').catch(() => {}); await game.close(); }
  }
}
async function click(game, text) {
  assert.ok(text, 'Expected an interactive control');
  // New Phaser interactive objects register on the next pre-update.
  await game.act({ keys: [], frames: 1 });
  return game.act({ click: { x: text.x + text.width / 2, y: text.y + text.height / 2 }, frames: 2 });
}
const buttons = state => state.panel.filter(text => text.interactive);
async function chooseAll(game) {
  for (let i = 0; i < 20; i++) {
    const state = await game.state();
    if (!state.paused || !state.economy.pendingUpgrades) return state;
    await click(game, buttons(state)[0]);
  }
  throw Error('Upgrade choices did not terminate');
}

await check('standing-auto-fire', async game => {
  const state = await game.act({ keys: [], frames: 120 });
  assert.ok(state.volleys >= 4 && state.kills > 0, 'Stationary players fire without any attack key');
  return { kills: state.kills, volleys: state.volleys };
});
await check('opening-combat', async game => {
  const start = await game.state(), end = await game.act({ keys: ['w'], frames: 120 });
  assert.ok(end.player.y < start.player.y - 100 && end.kills > 0);
  assert.ok(end.pickups > 0 || end.progression.xp > 0 || end.economy.gems > start.economy.gems);
  return { kills: end.kills, hp: end.player.hp };
});
await check('enemy-projectile', async game => {
  const start = await game.act({ fixture: 'enemy-projectile', frames: 1 });
  const end = await game.act({ frames: 20 });
  assert.ok(start.enemyShots[0].vy > 100 && end.enemyShots[0].y > start.enemyShots[0].y + 40);
  const hit = await game.act({ frames: 90 });
  assert.ok(hit.player.hp < start.player.hp, 'Real physics overlap must deal damage');
  return { hpAfterHit: hit.player.hp };
});
async function shop(game) {
  await game.act({ fixture: 'shop', keys: ['e'], frames: 1 });
  const start = await game.act({ keys: [], frames: 1 });
  const after = await click(game, buttons(start).find(text => text.text.includes('钩')));
  assert.equal(after.economy.hooks, start.economy.hooks + 1);
  assert.equal(after.economy.gems, start.economy.gems - 45);
  assert.equal(after.paused, true);
  const controls = buttons(after);
  for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
    const a = controls[i], b = controls[j];
    assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, 'Shop controls must not overlap');
  }
  await game.capture('shop');
  assert.equal((await click(game, controls.find(text => text.text === '返回战场'))).paused, false);
  return { hooks: after.economy.hooks, gems: after.economy.gems };
}
await check('shop-hook-click', shop);
await check('mobile-shop', shop, { viewport: { width: 390, height: 844 } });
await check('restart-listeners', async game => {
  const baseline = (await game.state()).inputListeners;
  for (let i = 0; i < 3; i++) {
    const dead = await game.act({ fixture: 'defeat', frames: 2 });
    assert.equal(dead.finished, true);
    await click(game, buttons(dead).find(text => text.text === '重新试飞'));
    const live = await game.act({ frames: 2 });
    assert.equal(live.finished, false); assert.equal(live.player.hp, live.player.maxHp);
    assert.deepEqual(live.inputListeners, baseline, 'Restart cannot accumulate input handlers');
  }
  return { listeners: baseline };
});
await check('pause-resume', async game => {
  await game.act({ keys: ['d'], frames: 15 });
  const paused = await game.act({ keys: ['p'], frames: 1 });
  const waited = await game.act({ keys: [], frames: 180 });
  assert.equal(waited.paused, true); assert.equal(waited.elapsedMs, paused.elapsedMs);
  assert.deepEqual(waited.player, paused.player);
  const resumed = await game.act({ keys: ['p', 'd'], frames: 30 });
  assert.equal(resumed.paused, false); assert.ok(resumed.elapsedMs > waited.elapsedMs);
  return { pausedAtMs: paused.elapsedMs, resumedAtMs: resumed.elapsedMs };
});
await check('directional-shield', async game => {
  const front = await game.act({ fixture: 'shield-front', keys: [], frames: 1 });
  const back = await game.act({ fixture: 'shield-back', frames: 1 });
  assert.equal(front.enemies[0].flankStacks, 0); assert.equal(back.enemies[0].flankStacks, 1);
  return { frontStacks: 0, backStacks: 1 };
});
await check('core-pickup', async game => {
  const state = await game.act({ fixture: 'core-pickup', frames: 1 });
  assert.ok(state.buffMs > 5900); assert.equal(state.pickups, 0);
  return { buffMs: state.buffMs };
});
await check('boss-half-no-heal', async game => {
  const start = await game.act({ fixture: 'boss-half', frames: 1 });
  const end = await game.act({ frames: 100 });
  assert.equal(end.enemies[0].phase, 2); assert.ok(end.enemies[0].hp <= start.enemies[0].hp);
  return { before: start.enemies[0].hp, after: end.enemies[0].hp };
});
await check('blast-one-hit', async game => {
  await game.act({ fixture: 'blast-test', frames: 1 });
  const state = await game.act({ frames: 90 });
  assert.equal(state.player.hp, 84, 'One explosion must deal 16, not a per-frame fraction');
  return { hpAfterBlast: state.player.hp };
});
await check('fixed-telegraph', async game => {
  const start = await game.act({ fixture: 'fixed-telegraph', frames: 1 });
  const end = await game.act({ frames: 45 });
  assert.equal(end.enemies[0].lockedAngle, start.enemies[0].lockedAngle);
  assert.ok(Math.abs(end.enemies[0].vx) < 0.01, 'Attack must follow the displayed vertical line');
  return { angle: end.enemies[0].lockedAngle };
});
await check('chapter-rest-and-demotion', async game => {
  const start = await game.act({ fixture: 'chapter-clear', frames: 1 });
  assert.equal(start.chapter.index, 1); assert.equal(start.intermissionMs, 5000); assert.equal(start.enemies.length, 0);
  const ready = await chooseAll(game), rest = await game.act({ keys: ['d'], frames: 120 });
  assert.equal(rest.elapsedMs, ready.elapsedMs); assert.equal(rest.enemies.length, 0);
  const next = await game.act({ keys: [], frames: 240 });
  assert.ok(next.enemies.some(enemy => enemy.variant === 'rider' && !enemy.boss));
  return { chapter: next.chapter.index, demotedRider: true };
});
await check('upgrade-no-free-reroll', async game => {
  const start = await game.act({ fixture: 'chapter-clear', frames: 1 });
  const candidates = buttons(start).slice(0, 3).map(text => text.text);
  for (let i = 0; i < 3; i++) {
    const state = await game.state();
    await click(game, buttons(state).find(text => text.text.includes('稍后')));
    const reopened = await game.act({ keys: ['e'], frames: 1 });
    await game.act({ keys: [], frames: 1 });
    assert.deepEqual(buttons(reopened).slice(0, 3).map(text => text.text), candidates);
    assert.equal(reopened.economy.pendingUpgrades, start.economy.pendingUpgrades);
  }
  return { candidatesPersist: true };
});
await check('final-boss-auto-victory', async game => {
  const state = await game.act({ fixture: 'final-clear', frames: 1 });
  assert.equal(state.finished, true); assert.equal(state.chapter.finished, true);
  assert.ok(state.panel.some(text => text.text.includes('远征完成')));
  return { chapter: state.chapter.index, finished: state.finished };
});
await check('dash-fixed-cooldown', async game => {
  const before = await game.state(), after = await game.act({ keys: ['Space'], frames: 1 });
  assert.ok(after.player.y < before.player.y - 100);
  const end = await game.act({ keys: [], frames: 240 });
  assert.equal(end.dashCooldownMs, 0);
  return { cooldownMs: after.dashCooldownMs };
});
await check('seeded-replay', async game => {
  const actions = ['w', 'd', 's', 'a'].map(key => ({ keys: [key], frames: 60 }));
  for (const action of actions) await game.act(action);
  const first = await game.capture('first');
  await game.act({ reset: true, frames: 0 });
  await game.act({ keys: ['Enter'], frames: 1 }); await game.act({ keys: [], frames: 1 });
  for (const action of actions) await game.act(action);
  const second = await game.capture('replayed');
  assert.deepEqual(second, first);
  return { frame: second.frame, kills: second.kills, fullSnapshotMatches: true };
});
await check('realtime-combat', async game => {
  for (const key of ['w', 'd', 's', 'a']) {
    await game.page.keyboard.down(key); await game.page.waitForTimeout(1400); await game.page.keyboard.up(key);
  }
  const state = await game.state();
  assert.ok(state.kills > 0 && state.elapsedMs >= 4000, 'Normal RAF must advance and auto-attack without debug stepping');
  return { elapsedMs: state.elapsedMs, kills: state.kills, hp: state.player.hp };
}, { manual: false });
await writeFile(path.join(output, 'report.json'), JSON.stringify(results, null, 2));
console.log(`${results.filter(result => result.passed).length}/${results.length} passed. Evidence: ${output}`);
if (results.some(result => !result.passed)) process.exitCode = 1;
