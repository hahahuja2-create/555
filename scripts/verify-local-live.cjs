'use strict';

// HTTP fixtures only: no database, production accounts, or copied account data.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const { createLocalLiveServer, railwayReviewConfiguration } = require('./local-live.cjs');
const { createMaintenance } = require('../platform-maintenance');

const token = crypto.randomBytes(32).toString('base64url');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });

test('private maintenance review opens customer APIs while preserving public closure and account authentication', async t => {
  const maintenance = createMaintenance({ enabled: true, resumesAt: '2099-10-31T14:00:00Z' }, undefined, { reviewToken: token });
  const backend = http.createServer(async (req, res) => {
    if (await maintenance.handle(req, res, new URL(req.url, 'http://localhost'))) return;
    res.writeHead(req.url === '/api/me' ? 401 : 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: req.url === '/api/me' ? 'AUTH_REQUIRED' : 'ordinary-handler' }));
  });
  const base = await listen(backend); t.after(() => close(backend));
  assert.equal((await fetch(base + '/api/me')).status, 503);
  assert.equal((await fetch(base + '/api/me', { headers: { 'x-taskmall-local-review': 'wrong' } })).status, 503);
  assert.equal((await fetch(base + '/api/me', { headers: { 'x-taskmall-local-review': crypto.randomBytes(32).toString('base64url') } })).status, 503);
  const privateResponse = await fetch(base + '/api/me', { headers: { 'x-taskmall-local-review': token } });
  assert.equal(privateResponse.status, 401); assert.equal((await privateResponse.json()).error, 'AUTH_REQUIRED');
  assert.equal((await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'x-taskmall-local-review': token } })).status, 200);
  assert.equal((await fetch(base + '/', { headers: { 'x-taskmall-local-review': token } })).status, 503);
  assert.equal((await fetch(base + '/pg-main.js', { headers: { 'x-taskmall-local-review': token } })).status, 503);
  assert.equal((await (await fetch(base + '/api/maintenance')).json()).active, true);
  assert.throws(() => createMaintenance(undefined, undefined, { reviewToken: 'bad' }), /INVALID_LOCAL_REVIEW_CONFIGURATION/);
});

test('local gateway preserves login, sessions, requests and streaming on the existing backend', async t => {
  const calls = [];
  const backend = http.createServer(async (req, res) => {
    let raw = ''; for await (const data of req) raw += data;
    calls.push({ url: req.url, method: req.method, headers: req.headers, body: raw });
    if (req.url === '/api/auth/login') {
      assert.equal(JSON.parse(raw).email, 'existing@example.invalid');
      res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': 'taskmall_session=fixture; HttpOnly; SameSite=Strict; Path=/; Secure; Domain=example.invalid' });
      return res.end(JSON.stringify({ user: { id: 'existing', lockedBalance: 101.04 } }));
    }
    if (req.url === '/api/markets/stream') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write('data: {"status":"live"}\n\n'); return res.end();
    }
    if (req.url === '/api/auth/logout') res.setHeader('Set-Cookie', 'taskmall_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Secure');
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ user: { id: 'existing' }, body: raw }));
  });
  const origin = await listen(backend); t.after(() => close(backend));
  const gateway = createLocalLiveServer({ origin, token });
  const local = await listen(gateway); t.after(() => close(gateway));
  const login = await fetch(local + '/api/auth/login', { method: 'POST', headers: { Origin: local, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'existing@example.invalid', password: 'fixture-only' }) });
  assert.equal(login.status, 200); assert.equal((await login.json()).user.lockedBalance, 101.04);
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.doesNotMatch(cookie, /Secure|Domain=/);
  const me = await fetch(local + '/api/me', { headers: { Cookie: 'other=private; ' + cookie.split(';')[0], Authorization: 'Bearer browser-value', 'x-taskmall-local-review': 'browser-value' } });
  assert.equal((await me.json()).user.id, 'existing');
  assert.equal(calls[1].headers.cookie, 'taskmall_session=fixture'); assert.equal(calls[1].headers.authorization, undefined);
  assert.equal(calls[1].headers['x-taskmall-local-review'], token);
  for (const call of calls) { assert.equal(call.headers.origin, origin); assert.equal(call.headers['sec-fetch-site'], 'same-origin'); }
  const patch = await fetch(local + '/api/profile', { method: 'PATCH', headers: { Origin: local, 'Content-Type': 'application/json' }, body: '{"name":"Example"}' });
  assert.equal((await patch.json()).body, '{"name":"Example"}'); assert.equal(calls.at(-1).method, 'PATCH');
  const stream = await fetch(local + '/api/markets/stream'); assert.equal(stream.headers.get('content-type'), 'text/event-stream');
  assert.match(await stream.text(), /"status":"live"/);
  const logout = await fetch(local + '/api/auth/logout', { method: 'POST', headers: { Origin: local, 'Content-Type': 'application/json' }, body: '{}' });
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/); assert.doesNotMatch(logout.headers.get('set-cookie'), /Secure/);
  const page = await fetch(local); assert.match(await page.text(), /<title>Portgainy<\/title>/);
  assert.equal(page.headers.get('strict-transport-security'), null);
  assert.equal((await fetch(local + '/pg-main.js')).status, 200);
  assert.equal((await fetch(local + '/fonts/arcade/manrope.woff2')).status, 200);
});

test('gateway refuses foreign websites, DNS rebinding, operator routes, private files and redirects', async t => {
  let count = 0;
  const backend = http.createServer((req, res) => { count++; res.writeHead(302, { Location: 'https://example.invalid', 'Set-Cookie': 'secret=do-not-forward' }); res.end(); });
  const origin = await listen(backend); t.after(() => close(backend));
  const gateway = createLocalLiveServer({ origin, token }); const local = await listen(gateway); t.after(() => close(gateway));
  for (const headers of [{ Origin: 'https://example.invalid' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    assert.equal((await fetch(local + '/api/me', { headers })).status, 403, JSON.stringify(headers));
  }
  const rebound = await new Promise((resolve, reject) => {
    http.get(local + '/api/me', { headers: { Host: 'example.invalid' } }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
  });
  assert.equal(rebound, 403);
  assert.equal((await fetch(local + '/api/operator/collections')).status, 403);
  for (const route of ['/.env', '/.env.mysql', '/%2eenv', '/%5c..%5c.env', '/operator/unlock', '/missing.js']) {
    assert.equal((await fetch(local + route)).status, 404, route);
  }
  assert.equal(count, 0);
  const response = await fetch(local + '/api/me'); assert.equal(response.status, 502);
  assert.equal((await response.json()).error, 'BACKEND_REDIRECT_REFUSED'); assert.equal(response.headers.get('set-cookie'), null);
});

test('Railway review configuration is identity-bound and sanitizes credential failures', async () => {
  const env = { TASKMALL_RAILWAY_PROJECT_ID: crypto.randomUUID(), TASKMALL_RAILWAY_SERVICE_ID: crypto.randomUUID(), TASKMALL_RAILWAY_ENVIRONMENT_ID: crypto.randomUUID() };
  const config = await railwayReviewConfiguration(env, async (cli, args) => {
    assert.equal(args[0], 'ssh'); assert.ok(args.includes(env.TASKMALL_RAILWAY_SERVICE_ID));
    assert.ok(!args.join(' ').includes(token)); return { stdout: JSON.stringify({ origin: 'https://taskmall.app', token }) };
  });
  assert.equal(config.token, token);
  await assert.rejects(railwayReviewConfiguration(env, async () => { throw new Error('password=secret'); }), /^Error: RAILWAY_LOCAL_REVIEW_UNAVAILABLE$/);
  await assert.rejects(railwayReviewConfiguration(env, async () => ({ stdout: JSON.stringify({ origin: 'https://wrong.invalid', token }) })), /RAILWAY_LOCAL_REVIEW_UNAVAILABLE/);
  await assert.rejects(railwayReviewConfiguration({}), /RAILWAY_IDENTITY_REQUIRED/);
});
