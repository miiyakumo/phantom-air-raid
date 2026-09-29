import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { openGame, root } from './lib/game-browser.mjs';

const { values } = parseArgs({ options: { output: { type: 'string', default: 'output/gameplay-checks/latest' } } });
const output = path.resolve(root, values.output);
const results = [];
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

await check('opening-combat', async game => {
  const start = await game.state();
  const end = await game.act({ keys: ['w', 'j'], frames: 120 });
  assert.ok(end.player.y < start.player.y - 100, 'Movement must move the player');
  assert.ok(end.kills > 0, 'Opening attacks should kill a real enemy');
  assert.ok(end.pickups > 0 || end.progression.xp > 0 || end.economy.gems > start.economy.gems,
    'A killed enemy should finish spawning its reward');
  return { kills: end.kills, volleys: end.volleys, hp: end.player.hp };
});

await check('enemy-projectile', async game => {
  const start = await game.act({ fixture: 'enemy-projectile', frames: 1 });
  await game.capture('launched');
  const end = await game.act({ frames: 20 });
  await game.capture('after-20-frames');
  assert.ok(start.enemyShots[0].vy > 100, 'Enemy projectile must retain launch velocity after group insertion');
  assert.ok(end.enemyShots[0].y > start.enemyShots[0].y + 40, 'Enemy projectile must travel toward the player');
  const hit = await game.act({ frames: 90 });
  assert.ok(hit.player.hp < start.player.hp, 'Real physics overlap must damage the player');
  return { initialY: start.enemyShots[0].y, finalY: end.enemyShots[0].y, hpAfterHit: hit.player.hp };
});

const checkShop = async game => {
  await game.act({ fixture: 'shop', keys: ['e'], frames: 1 });
  await game.act({ keys: [], frames: 1 });
  const shop = await game.capture('shop');
  const hook = shop.panel.find(text => text.interactive && text.text.includes('钩'));
  assert.ok(hook, 'Shop contains a hook offer');
  const after = await game.act({ click: { x: hook.x + hook.width / 2, y: hook.y + hook.height / 2 }, frames: 1 });
  assert.equal(after.economy.hooks, shop.economy.hooks + 1, 'Clicking the hook offer must buy the hook');
  assert.equal(after.economy.gems, shop.economy.gems - 45);
  assert.equal(after.paused, true, 'Purchase should leave the shop open');
  const buttons = after.panel.filter(text => text.interactive);
  for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) {
    const a = buttons[i], b = buttons[j];
    assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y,
      `Shop buttons overlap: ${a.text} / ${b.text}`);
  }
  const back = buttons.find(text => text.text.includes('返回战场'));
  const resumed = await game.act({ click: { x: back.x + back.width / 2, y: back.y + back.height / 2 }, frames: 1 });
  assert.equal(resumed.paused, false);
  return { hooks: after.economy.hooks, gems: after.economy.gems };
};
await check('shop-hook-click', checkShop);
await check('mobile-shop', checkShop, { viewport: { width: 390, height: 844 } });

await check('restart-listeners', async game => {
  const start = await game.state();
  const counts = [start.listeners['skill-fed']];
  for (let i = 0; i < 3; i++) {
    await game.act({ fixture: 'defeat', frames: 2 });
    const dead = await game.capture(`defeat-${i}`);
    assert.equal(dead.finished, true);
    const retry = dead.panel.find(text => text.text === '重新试飞');
    const restarted = await game.act({ click: { x: retry.x + retry.width / 2, y: retry.y + retry.height / 2 }, frames: 2 });
    assert.equal(restarted.finished, false);
    assert.equal(restarted.player.hp, restarted.player.maxHp);
    counts.push(restarted.listeners['skill-fed']);
  }
  assert.deepEqual(counts, [1, 1, 1, 1], 'Restart must not accumulate gameplay event listeners');
  return { listenerCounts: counts };
});

await check('pause-resume', async game => {
  await game.act({ keys: ['d'], frames: 15 });
  const paused = await game.act({ keys: ['p'], frames: 1 });
  const waited = await game.act({ keys: [], frames: 180 });
  assert.equal(waited.paused, true);
  assert.equal(waited.elapsedMs, paused.elapsedMs);
  assert.deepEqual(waited.player, paused.player, 'Player cannot drift while paused');
  const resumed = await game.act({ keys: ['p', 'd'], frames: 30 });
  assert.equal(resumed.paused, false);
  assert.ok(resumed.elapsedMs > waited.elapsedMs && resumed.player.x > waited.player.x);
  return { pausedAtMs: paused.elapsedMs, resumedAtMs: resumed.elapsedMs };
});

await check('directional-shield', async game => {
  const front = await game.act({ fixture: 'shield-front', frames: 1 });
  await game.capture('front');
  const back = await game.act({ fixture: 'shield-back', frames: 1 });
  await game.capture('back');
  assert.equal(front.enemies[0].flankStacks, 0, 'Front-facing shield must block incoming shots');
  assert.equal(back.enemies[0].flankStacks, 1, 'Back-facing hit must count as a flank');
  return { frontStacks: front.enemies[0].flankStacks, backStacks: back.enemies[0].flankStacks };
});

await check('seeded-replay', async game => {
  const actions = [
    { keys: ['w', 'j'], frames: 60 }, { keys: ['d', 'j'], frames: 60 },
    { keys: ['s', 'j'], frames: 60 }, { keys: ['a', 'j'], frames: 60 },
  ];
  for (const action of actions) await game.act(action);
  const first = await game.capture('first');
  await game.act({ reset: true, frames: 0 });
  await game.act({ keys: ['Enter'], frames: 1 });
  await game.act({ keys: [], frames: 1 });
  for (const action of actions) await game.act(action);
  const second = await game.capture('replayed');
  assert.deepEqual(second, first, 'Full snapshots must match after reset and replay');
  return { frame: second.frame, kills: second.kills, fullSnapshotMatches: true };
});

await check('realtime-combat', async game => {
  await game.page.keyboard.down('j');
  for (const key of ['w', 'd', 's', 'a']) {
    await game.page.keyboard.down(key);
    await game.page.waitForTimeout(1400);
    await game.page.keyboard.up(key);
  }
  await game.page.keyboard.up('j');
  const state = await game.state();
  assert.ok(state.kills > 0, 'Normal RAF gameplay must kill enemies without the manual clock');
  assert.ok(state.elapsedMs >= 4000, 'Real combat must keep advancing');
  return { elapsedMs: state.elapsedMs, kills: state.kills, hp: state.player.hp };
}, { manual: false });

await writeFile(path.join(output, 'report.json'), JSON.stringify(results, null, 2));
console.log(`${results.filter(r => r.passed).length}/${results.length} passed. Evidence: ${output}`);
if (results.some(r => !r.passed)) process.exitCode = 1;
