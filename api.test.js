// HTTP checks only: these do not contain endpoint implementations or assign marks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

async function startApi(t) {
  // Use a separate port and a fresh server for each test, leaving port 3000 alone.
  const reservation = createServer();
  await new Promise((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '', spawnError;
  child.stdout.on('data', chunk => { logs = (logs + chunk).slice(-4000); });
  child.stderr.on('data', chunk => { logs = (logs + chunk).slice(-4000); });
  child.on('error', error => { spawnError = error; });
  let exited = false;
  const exit = new Promise(resolve => child.once('exit', () => { exited = true; resolve(); }));
  t.after(async () => {
    if (!exited) {
      child.kill('SIGTERM');
      await Promise.race([exit, delay(1500, undefined, { ref: false })]);
      if (!exited) { child.kill('SIGKILL'); await exit; }
    }
  });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (spawnError || exited) throw new Error(`Server could not start: ${spawnError?.message || logs}`);
    try {
      const response = await fetch(`${base}/api/equipment`, { signal: AbortSignal.timeout(500) });
      await response.arrayBuffer();
      ready = true;
      break;
    } catch { await delay(50); }
  }
  assert.ok(ready, `Server did not respond on PORT=${port}. ${logs}`);
  return async (method, route, body) => {
    const response = await fetch(base + route, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(4000)
    });
    const text = await response.text();
    assert.ok(response.ok, `${method} ${route}: expected success, received ${response.status}: ${text.slice(0, 150)}`);
    try { return text ? JSON.parse(text) : null; } catch { return text; }
  };
}

const fields = item => Object.fromEntries(['name', 'category', 'brand', 'year', 'quantity'].map(key => [key, item?.[key]]));
const example = { name: 'API Test Recorder', category: 'audio', brand: 'Test Brand', year: 2024, quantity: 2 };

test('GET all: returns an equipment array with the expected fields', async t => {
  const call = await startApi(t);
  const items = await call('GET', '/api/equipment');
  assert.ok(Array.isArray(items), 'Response must be a JSON array');
  assert.ok(items.length > 0, 'Equipment array must not be empty');
  for (const item of items) {
    for (const key of ['name', 'category', 'brand']) assert.equal(typeof item[key], 'string', `${key} must be a string`);
    for (const key of ['year', 'quantity']) assert.equal(typeof item[key], 'number', `${key} must be a number`);
  }
});

test('Starting collection: five supplied items plus two additions = seven', async t => {
  const call = await startApi(t);
  const items = await call('GET', '/api/equipment');
  assert.ok(Array.isArray(items), 'Response must be a JSON array');
  assert.equal(items.length, 7, 'Add exactly two items to the five supplied items');
});

test('GET filter: returns all and only equipment in the requested category', async t => {
  const call = await startApi(t);
  const items = await call('GET', '/api/equipment');
  assert.ok(Array.isArray(items));
  const result = await call('GET', '/api/equipment/filter?category=audio');
  assert.ok(Array.isArray(result), 'Filter response must be a JSON array');
  const sorted = values => values.map(item => JSON.stringify(fields(item))).sort();
  assert.deepEqual(sorted(result), sorted(items.filter(item => item.category === 'audio')));
});

test('GET by index: index 0 returns the first item', async t => {
  const call = await startApi(t);
  const items = await call('GET', '/api/equipment');
  assert.ok(Array.isArray(items) && items.length > 0);
  const item = await call('GET', '/api/equipment/0');
  assert.deepEqual(fields(item), fields(items[0]));
});

test('POST: adds an item that can be retrieved at the next array index', async t => {
  const call = await startApi(t);
  const before = await call('GET', '/api/equipment');
  assert.ok(Array.isArray(before));
  await call('POST', '/api/equipment', example);
  const after = await call('GET', '/api/equipment');
  assert.equal(after.length, before.length + 1);
  assert.deepEqual(after.slice(0, before.length), before, 'Existing records must be preserved');
  assert.deepEqual(fields(await call('GET', `/api/equipment/${before.length}`)), example);
});

test('PUT: updates the requested item without changing the collection size', async t => {
  const call = await startApi(t);
  const before = await call('GET', '/api/equipment');
  assert.ok(Array.isArray(before) && before.length > 0);
  await call('PUT', '/api/equipment/0', example);
  assert.deepEqual(fields(await call('GET', '/api/equipment/0')), example);
  const after = await call('GET', '/api/equipment');
  assert.equal(after.length, before.length);
  assert.deepEqual(after.slice(1), before.slice(1), 'Other records must be preserved');
});

test('DELETE: removes the requested item and the following indexes shift', async t => {
  const call = await startApi(t);
  const before = await call('GET', '/api/equipment');
  assert.ok(Array.isArray(before) && before.length > 1);
  await call('DELETE', '/api/equipment/0');
  const after = await call('GET', '/api/equipment');
  assert.deepEqual(after, before.slice(1));
  assert.deepEqual(fields(await call('GET', '/api/equipment/0')), fields(before[1]));
});
