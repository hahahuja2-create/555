'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const configuration = require('./config/platform-maintenance.json');

function createMaintenance(config = configuration, publicDirectory = path.join(__dirname, 'public')) {
  const resumesAt = Date.parse(config.resumesAt);
  if (typeof config.enabled !== 'boolean' || !Number.isFinite(resumesAt)) throw new Error('INVALID_MAINTENANCE_CONFIGURATION');
  const isActive = (now = Date.now()) => config.enabled && now < resumesAt;
  const assets = new Map([
    ['/maintenance.js', 'text/javascript; charset=utf-8'],
    ['/maintenance.css', 'text/css; charset=utf-8'],
    ['/favicon.svg', 'image/svg+xml'],
    ['/fonts/arcade/big-shoulders.woff2', 'font/woff2'],
    ['/fonts/arcade/manrope.woff2', 'font/woff2'], ['/fonts/arcade/chakra-petch-600.woff2', 'font/woff2']
  ]);

  async function handle(req, res, url, now = Date.now()) {
    const active = isActive(now);
    if (url.pathname === '/api/maintenance' && ['GET', 'HEAD'].includes(req.method)) {
      const body = Buffer.from(JSON.stringify({ active, resumesAt: new Date(resumesAt).toISOString(), serverTime: now }));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
      return true;
    }
    // Keep monitoring and authenticated wallet operations available during the public closure.
    if (!active || url.pathname === '/api/health' || url.pathname.startsWith('/api/operator/') || url.pathname.startsWith('/operator/')) return false;
    const retryAfter = new Date(resumesAt).toUTCString();
    if (url.pathname.startsWith('/api/')) {
      const body = Buffer.from(JSON.stringify({ error: 'MAINTENANCE_MODE', resumesAt: new Date(resumesAt).toISOString() }));
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': retryAfter, 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
      return true;
    }
    const asset = ['GET', 'HEAD'].includes(req.method) && assets.get(url.pathname);
    const body = await fs.readFile(path.join(publicDirectory, asset ? url.pathname.slice(1) : 'maintenance.html'));
    res.writeHead(asset ? 200 : 503, { 'Content-Type': asset || 'text/html; charset=utf-8', 'Content-Length': body.length,
      'Cache-Control': 'no-store', ...(!asset ? { 'Retry-After': retryAfter, 'X-Robots-Tag': 'noindex' } : {}) });
    res.end(req.method === 'HEAD' ? undefined : body);
    return true;
  }
  return { isActive, handle };
}

module.exports = { createMaintenance };
