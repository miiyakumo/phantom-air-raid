import { preview } from 'vite';
import assert from 'node:assert/strict';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { openGame } from './lib/game-browser.mjs';

const server = await preview({ preview: { host: '127.0.0.1', port: 4185, strictPort: false }, logLevel: 'error' });
let game;
try {
  const files = (await readdir('dist/assets')).filter(file => file.endsWith('.js'));
  for (const file of files) {
    assert.equal((await readFile('dist/assets/' + file, 'utf8')).includes('__gameDebug'), false,
      'Production must not bundle the debug bridge');
  }
  game = await openGame({ debug: false, baseURL: server.resolvedUrls.local[0] + '?debug=1&manual=1',
    output: 'output/gameplay-checks/production' });
  await game.page.waitForTimeout(250);
  assert.equal(await game.page.evaluate(() => typeof window.__gameDebug), 'undefined');
  await game.capture('menu');
  await game.page.mouse.click(480, 411);
  await game.page.waitForTimeout(200);
  await game.page.keyboard.down('j');
  for (const key of ['w', 'd', 's', 'a']) {
    await game.page.keyboard.down(key);
    await game.page.waitForTimeout(1200);
    await game.page.keyboard.up(key);
  }
  await game.capture('combat');
  assert.deepEqual(game.errors, []);
  await writeFile('output/gameplay-checks/production/report.json', JSON.stringify({
    passed: true, productionBundleHasDebugBridge: false, debugQueryHasNoEffect: true,
    realtimeInputSeconds: 4.8, browserErrors: game.errors,
  }, null, 2));
  console.log('Production passed: no debug bridge; real keyboard/mouse smoke run has no browser errors.');
} finally {
  await game?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
