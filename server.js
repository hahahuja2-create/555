'use strict';

// The retired TaskMall host serves a migration notice without opening the ledger.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const DESTINATION = 'https://portgainy.com';
const assetTypes = new Map([
  ['/maintenance.js', 'text/javascript; charset=utf-8'],
  ['/maintenance.css', 'text/css; charset=utf-8'],
  ['/favicon.svg', 'image/svg+xml'],
  ['/portgainy-mark.svg', 'image/svg+xml'],
  ['/fonts/inter-latin.woff2', 'font/woff2'],
  ['/fonts/georgian.woff2', 'font/woff2']
]);

async function createServer() {
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
    const json = (status, value) => {
      const body = Buffer.from(JSON.stringify(value));
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    req.resume();
    if (url.pathname === '/api/health') return json(200, { ok: true, service: 'taskmall-migration-notice', database: false });
    // Open copies of the previous maintenance page reload once to show this notice.
    if (url.pathname === '/api/maintenance') return json(200, { active: false, moved: true, origin: DESTINATION });
    const asset = ['GET', 'HEAD'].includes(req.method) && assets.get(url.pathname);
    if (asset) {
      res.writeHead(200, { 'Content-Type': asset.type, 'Content-Length': asset.body.length });
      return res.end(req.method === 'HEAD' ? undefined : asset.body);
    }
    if (url.pathname === '/api' || url.pathname.startsWith('/api/') || url.pathname === '/operator' || url.pathname.startsWith('/operator/')) {
      return json(410, { error: 'PLATFORM_MOVED', origin: DESTINATION });
    }
    if (!['GET', 'HEAD'].includes(req.method)) return json(405, { error: 'METHOD_NOT_ALLOWED' });
    res.setHeader('X-Robots-Tag', 'noindex');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': page.length });
    res.end(req.method === 'HEAD' ? undefined : page);
  });
}

if (require.main === module) {
  createServer().then(server => {
    server.requestTimeout = 30_000; server.headersTimeout = 15_000;
    server.listen(Number(process.env.PORT || 8080), '0.0.0.0', () => console.log('TaskMall migration notice ready; database disabled.'));
    const stop = () => { server.closeAllConnections(); server.close(() => process.exit(0)); };
    process.once('SIGTERM', stop); process.once('SIGINT', stop);
  }).catch(() => { console.error('MAINTENANCE_ASSETS_UNAVAILABLE'); process.exitCode = 1; });
}

module.exports = { createServer, DESTINATION };
