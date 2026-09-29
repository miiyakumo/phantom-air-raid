import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { openGame } from './lib/game-browser.mjs';

const { values } = parseArgs({ options: {
  seed: { type: 'string', default: '1' },
  output: { type: 'string', default: 'output/game-control/latest' },
  headed: { type: 'boolean', default: false }, mobile: { type: 'boolean', default: false },
} });
const game = await openGame({ ...values, viewport: values.mobile ? { width: 390, height: 844 } : undefined });
const summary = state => {
  const { texts, listeners, ...rest } = state;
  return rest;
};
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
try {
  console.log(JSON.stringify({ ready: true, output: game.directory, state: summary(await game.state()) }));
  for await (const line of input) {
    if (!line.trim()) continue;
    try {
      const command = JSON.parse(line);
      if (command.quit) break;
      const state = command.state || command.capture ? await game.state() : await game.act(command);
      if (command.capture) await game.capture(command.capture);
      await game.save();
      console.log(JSON.stringify({ state: summary(state), screenshot: command.capture
        ? path.join(game.directory, command.capture + '.png') : undefined, errors: game.errors }));
    } catch (error) {
      console.log(JSON.stringify({ error: error.message }));
    }
  }
} finally { input.close(); await game.close(); }
