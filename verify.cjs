'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer, RESUMES_AT, DESTINATION } = require('./server');

test('the original notice is served without a financial backend, then leads to Portgainy at the exact deadline', async t => {
  let now = Date.parse(RESUMES_AT) - 1;
  const server = await createServer({ now: () => now });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = 'http://127.0.0.1:' + server.address().port;
  const page = await fetch(base); assert.equal(page.status, 503);
  const text = await page.text();
  assert.match(text, /TaskMall/); assert.match(text, /31 ოქტომბერს, 18:00-ზე/);
  assert.match(text, /maintenance-language/); assert.equal(page.headers.get('cache-control'), 'no-store');
  for (const route of ['/maintenance.css', '/maintenance.js', '/favicon.svg', '/fonts/inter-latin.woff2', '/fonts/georgian.woff2']) {
    assert.equal((await fetch(base + route)).status, 200);
  }
  assert.equal((await (await fetch(base + '/api/health')).json()).database, false);
  assert.equal((await (await fetch(base + '/api/maintenance')).json()).active, true);
  for (const route of ['/api/auth/login', '/api/earn/claim', '/api/operator/collections', '/operator/unlock']) {
    assert.equal((await fetch(base + route, { method: 'POST' })).status, 503);
  }
  now = Date.parse(RESUMES_AT);
  assert.equal((await (await fetch(base + '/api/maintenance')).json()).active, false);
  const moved = await fetch(base + '/?ref=EXISTING', { redirect: 'manual' });
  assert.equal(moved.status, 307); assert.equal(moved.headers.get('location'), DESTINATION + '/?ref=EXISTING');
  assert.equal((await fetch(base + '/api/earn/claim', { method: 'POST' })).status, 503);
});
