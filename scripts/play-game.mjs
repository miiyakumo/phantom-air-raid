import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { openGame } from './lib/game-browser.mjs';

const { values } = parseArgs({ options: {
  seed: { type: 'string', default: '1' }, seconds: { type: 'string', default: '30' },
  output: { type: 'string', default: 'output/playtest/latest' },
  replay: { type: 'string' }, headed: { type: 'boolean', default: false },
  mobile: { type: 'boolean', default: false },
} });
const replay = values.replay ? JSON.parse(await readFile(values.replay, 'utf8')) : null;
const game = await openGame({ seed: replay?.seed ?? values.seed, headed: values.headed,
  viewport: replay?.viewport ?? (values.mobile ? { width: 390, height: 844 } : undefined), output: values.output });
const samples = [];
try {
  await game.capture('menu');
  if (replay) {
    if (replay.version !== 1 || !Array.isArray(replay.actions)) throw new Error('Unsupported replay');
    for (const action of replay.actions) samples.push(await game.act(action));
  } else {
    await game.act({ keys: ['Enter'], frames: 1 });
    await game.act({ keys: [], frames: 1 });
    await game.capture('start');
    // A simple pilot follows a rectangle and uses the same keys as a player.
    // This is a repeatable exploratory run, not a claim that the game is balanced.
    const seconds = Number(values.seconds);
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 600) throw new Error('seconds must be 1..600');
    for (let second = 0; second < seconds; second++) {
      let state = await game.state();
      if (state.finished) break;
      if (state.paused) {
        const button = state.panel.find(text => text.interactive);
        if (!button) throw new Error('Paused without a button');
        state = await game.act({ keys: [], click: { x: button.x + button.width / 2, y: button.y + button.height / 2 }, frames: 1 });
      }
      const direction = ['w', 'd', 's', 'a'][Math.floor(second / 2) % 4];
      state = await game.act({ keys: [direction, 'j'], frames: 60 });
      samples.push(state);
      if ((second + 1) % 10 === 0) await game.capture(`battle-${second + 1}s`);
    }
  }
  const final = await game.capture('final');
  await writeFile(path.join(game.directory, 'samples.json'), JSON.stringify(samples, null, 2));
  console.log(JSON.stringify({ output: game.directory, elapsedMs: final.elapsedMs, kills: final.kills,
    hp: final.player?.hp, volleys: final.volleys, chapter: final.chapter, errors: game.errors }, null, 2));
  if (game.errors.length) process.exitCode = 1;
} finally { await game.close(); }
