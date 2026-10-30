'use strict';

// The retired TaskMall host serves only the original maintenance notice. This
// process has no application/database dependencies and cannot become a writer.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const RESUMES_AT = '2026-10-31T14:00:00.000Z';
const DESTINATION = 'https://555-production-d903.up.railway.app';
const assetTypes = new Map([
  ['/maintenance.js', 'text/javascript; charset=utf-8'],
  ['/maintenance.css', 'text/css; charset=utf-8'],
  ['/favicon.svg', 'image/svg+xml'],
  ['/fonts/inter-latin.woff2', 'font/woff2'],
  ['/fonts/georgian.woff2', 'font/woff2']
]);

async function createServer({ now = Date.now } = {}) {
  const publicDirectory = path.join(__dirname, 'public');
  const page = await fs.readFile(path.join(publicDirectory, 'maintenance.html'));
  const assets = new Map(await Promise.all([...assetTypes].map(async ([url, type]) =>
    [url, { type, body: await fs.readFile(path.join(publicDirectory, url.slice(1))) }])));
  return http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    const url = new URL(req.url, 'http://maintenance.local');
    const time = now();
    const active = time < Date.parse(RESUMES_AT);
    const json = (status, value) => {
      const body = Buffer.from(JSON.stringify(value));
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    req.resume();
    if (url.pathname === '/api/health') return json(200, { ok: true, service: 'taskmall-maintenance', database: false });
    if (url.pathname === '/api/maintenance') return json(200, { active, resumesAt: RESUMES_AT, serverTime: time });
    const asset = ['GET', 'HEAD'].includes(req.method) && assets.get(url.pathname);
    if (asset) {
      res.writeHead(200, { 'Content-Type': asset.type, 'Content-Length': asset.body.length });
      return res.end(req.method === 'HEAD' ? undefined : asset.body);
    }
    res.setHeader('Retry-After', new Date(RESUMES_AT).toUTCString());
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/operator/')) {
      return json(503, { error: active ? 'MAINTENANCE_MODE' : 'PLATFORM_MOVED', resumesAt: RESUMES_AT, ...(!active ? { origin: DESTINATION } : {}) });
    }
    if (!active && ['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(307, { Location: DESTINATION + url.pathname + url.search }); return res.end();
    }
    res.setHeader('X-Robots-Tag', 'noindex');
    res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': page.length });
    res.end(req.method === 'HEAD' ? undefined : page);
  });
}

if (require.main === module) {
  createServer().then(server => {
    server.requestTimeout = 30_000; server.headersTimeout = 15_000;
    server.listen(Number(process.env.PORT || 8080), '0.0.0.0', () => console.log('TaskMall maintenance notice ready; database disabled.'));
    const stop = () => { server.closeAllConnections(); server.close(() => process.exit(0)); };
    process.once('SIGTERM', stop); process.once('SIGINT', stop);
  }).catch(() => { console.error('MAINTENANCE_ASSETS_UNAVAILABLE'); process.exitCode = 1; });
}

module.exports = { createServer, RESUMES_AT, DESTINATION };
