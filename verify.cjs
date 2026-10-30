'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer, DESTINATION } = require('./server');

test('the old domain displays the migration notice and never exposes financial APIs', async t => {
  const server = await createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = 'http://127.0.0.1:' + server.address().port;
  for (const route of ['/', '/?ref=EXISTING', '/earn']) {
    const page = await fetch(base + route); assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /ჩვენ Portgainy‑ზე გადავედით/);
    assert.match(html, /ანგარიში და თანხები შენარჩუნებულია/);
    assert.match(html, /href="https:\/\/portgainy\.com\/"/);
    assert.equal(page.headers.get('cache-control'), 'no-store');
  }
  for (const route of ['/maintenance.css', '/maintenance.js', '/favicon.svg', '/portgainy-mark.svg', '/fonts/inter-latin.woff2', '/fonts/georgian.woff2']) {
    assert.equal((await fetch(base + route)).status, 200, route);
  }
  assert.equal((await (await fetch(base + '/api/health')).json()).database, false);
  assert.deepEqual(await (await fetch(base + '/api/maintenance')).json(), { active: false, moved: true, origin: DESTINATION });
  for (const route of ['/api/auth/login', '/api/earn/claim', '/api/operator/collections', '/operator/unlock']) {
    const response = await fetch(base + route, { method: 'POST' });
    assert.equal(response.status, 410); assert.equal((await response.json()).error, 'PLATFORM_MOVED');
  }
});
