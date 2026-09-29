import { createServer } from 'vite';
import assert from 'node:assert/strict';

const spec = process.argv[2];
assert.ok(spec, 'usage: node scripts/run-ts-test.mjs <test-file>');
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  await server.ssrLoadModule('/' + spec.replace(/^\.\//, ''));
} finally {
  await server.close();
}
