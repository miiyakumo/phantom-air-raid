import { chromium } from 'playwright';
import { createServer } from 'vite';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../../', import.meta.url));

export async function openGame({ seed = '1', viewport = { width: 960, height: 540 }, headed = false,
  manual = true, debug = true, baseURL, output = 'output/playtest/latest' } = {}) {
  let server;
  let browser;
  const directory = path.resolve(root, output);
  await mkdir(directory, { recursive: true });
  try {
    if (!baseURL) {
      server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false } });
      await server.listen();
      baseURL = server.resolvedUrls.local[0];
    }
    const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (existsSync(chrome) ? chrome : undefined);
    browser = await chromium.launch({ headless: !headed, executablePath });
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: true });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push({ type: 'pageerror', message: error.message }));
    page.on('console', message => { if (message.type() === 'error') errors.push({ type: 'console', message: message.text() }); });
    const url = new URL(baseURL);
    if (debug) {
      url.searchParams.set('debug', '1');
      url.searchParams.set('seed', seed);
      if (manual) url.searchParams.set('manual', '1');
    }
    await page.goto(url.href);
    if (debug) await page.waitForFunction(() => window.__gameDebug?.getState().ready, null, { timeout: 15000 });
    else await page.waitForSelector('canvas');
    const actions = [];
    let held = new Set();
    const state = () => page.evaluate(() => window.__gameDebug.getState());
    const coords = async (x, y) => {
      const box = await page.locator('canvas').boundingBox();
      return { x: box.x + x / 960 * box.width, y: box.y + y / 540 * box.height };
    };
    const act = async action => {
      actions.push(structuredClone(action));
      if (action.reset) {
        for (const key of held) await page.keyboard.up(key);
        await page.mouse.up();
        held = new Set();
        await page.goto(url.href);
        await page.waitForFunction(() => window.__gameDebug?.getState().ready);
      }
      if (action.fixture) await page.evaluate(name => window.__gameDebug.loadFixture(name), action.fixture);
      if (action.keys) {
        const next = new Set(action.keys);
        for (const key of held) if (!next.has(key)) await page.keyboard.up(key);
        for (const key of next) if (!held.has(key)) await page.keyboard.down(key);
        held = next;
      }
      if (action.click) {
        const p = await coords(action.click.x, action.click.y);
        await page.mouse.click(p.x, p.y);
      }
      if (action.pointer) {
        const p = await coords(action.pointer.x, action.pointer.y);
        await page.mouse.move(p.x, p.y);
        if (action.pointer.down === true) await page.mouse.down();
        if (action.pointer.down === false) await page.mouse.up();
      }
      let frames = action.frames ?? 1;
      while (frames > 0) {
        const batch = Math.min(600, frames);
        try { await page.evaluate(n => window.__gameDebug.step(n), batch); }
        catch (error) {
          errors.push({ type: 'step', action, message: error.message });
          await capture('failure');
          throw error;
        }
        frames -= batch;
      }
      return state();
    };
    const capture = async name => {
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Capture name must contain only letters, digits, _ or -');
      const snapshot = debug ? await state() : null;
      await page.screenshot({ path: path.join(directory, `${name}.png`) });
      await writeFile(path.join(directory, `${name}.json`), JSON.stringify(snapshot, null, 2));
      return snapshot;
    };
    const save = async () => {
      await writeFile(path.join(directory, 'replay.json'), JSON.stringify({ version: 1, seed, viewport, actions }, null, 2));
      await writeFile(path.join(directory, 'errors.json'), JSON.stringify(errors, null, 2));
    };
    return { page, context, actions, errors, directory, state, act, capture, save,
      async close() {
        try { await save(); await context.tracing.stop({ path: path.join(directory, 'trace.zip') }); }
        finally { await browser.close(); await server?.close(); }
      } };
  } catch (error) { await browser?.close(); await server?.close(); throw error; }
}
