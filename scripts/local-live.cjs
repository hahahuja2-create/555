'use strict';

// Serve the working tree's UI on loopback; all account and financial operations
// run on the existing Railway application. This process never opens a database.
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const BACKEND = 'https://taskmall.app';
const REVIEW_HEADER = 'x-taskmall-local-review';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff' };

function json(res, status, error) {
  if (res.headersSent) { res.destroy(); return; }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ error }));
}

async function railwayReviewConfiguration(env = process.env, execute = promisify(execFile)) {
  const ids = [env.TASKMALL_RAILWAY_PROJECT_ID, env.TASKMALL_RAILWAY_SERVICE_ID, env.TASKMALL_RAILWAY_ENVIRONMENT_ID];
  if (!ids.every(value => UUID.test(value || ''))) throw new Error('RAILWAY_IDENTITY_REQUIRED');
  const source = `(()=>{
    if(process.env.RAILWAY_PROJECT_ID!==${JSON.stringify(ids[0])}||process.env.RAILWAY_SERVICE_ID!==${JSON.stringify(ids[1])}
      ||process.env.RAILWAY_ENVIRONMENT_ID!==${JSON.stringify(ids[2])})throw new Error('WRONG_BACKEND');
    console.log(JSON.stringify({origin:process.env.PUBLIC_ORIGIN,token:process.env.TASKMALL_LOCAL_REVIEW_TOKEN}));
  })()`;
  const capsule = 'eval(Buffer.from("' + Buffer.from(source).toString('base64') + '","base64").toString("utf8"))';
  const cli = env.TASKMALL_RAILWAY_CLI_FILE || (process.platform === 'win32'
    ? path.join(env.APPDATA || '', 'npm/node_modules/@railway/cli/bin/railway.exe') : 'railway');
  try {
    const { stdout } = await execute(cli, ['ssh', '-p', ids[0], '-s', ids[1], '-e', ids[2], '--', `node -e '${capsule}'`],
      { windowsHide: true, timeout: 30_000, maxBuffer: 32_000 });
    const config = JSON.parse(stdout.trim());
    if (config.origin !== BACKEND || !/^[A-Za-z0-9_-]{43}$/.test(config.token || '')) throw new Error();
    return config;
  } catch { throw new Error('RAILWAY_LOCAL_REVIEW_UNAVAILABLE'); }
}

function createLocalLiveServer({ origin = BACKEND, token, publicDirectory = path.join(__dirname, '..', 'public') }) {
  const upstream = new URL(origin);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token || '')) throw new Error('LOCAL_REVIEW_TOKEN_REQUIRED');
  if (upstream.origin !== origin || (upstream.protocol !== 'https:'
    && !(upstream.protocol === 'http:' && upstream.hostname === '127.0.0.1'))) throw new Error('INVALID_BACKEND_ORIGIN');
  const root = path.resolve(publicDirectory);
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    try {
      const host = req.headers.host;
      const port = server.address()?.port;
      if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(host)) return json(res, 403, 'LOCAL_HOST_REQUIRED');
      const localOrigin = `http://${host}`;
      if ((req.headers.origin && req.headers.origin !== localOrigin) || req.headers['sec-fetch-site'] === 'cross-site') {
        return json(res, 403, 'ORIGIN_NOT_ALLOWED');
      }
      if (!req.url.startsWith('/') || req.url.startsWith('//')) return json(res, 400, 'INVALID_PATH');
      const url = new URL(req.url, localOrigin);
      if (url.pathname.startsWith('/api/')) {
        if (/^\/api\/operator(?:\/|$)/.test(url.pathname)) return json(res, 403, 'OPERATOR_ROUTE_NOT_AVAILABLE');
        if (!['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return json(res, 405, 'METHOD_NOT_ALLOWED');
        if (Number(req.headers['content-length'] || 0) > 1_000_000) return json(res, 413, 'BODY_TOO_LARGE');
        const headers = { accept: req.headers.accept || 'application/json', [REVIEW_HEADER]: token, origin, 'sec-fetch-site': 'same-origin' };
        for (const name of ['content-type', 'last-event-id']) if (req.headers[name]) headers[name] = req.headers[name];
        const cookies = (req.headers.cookie || '').split(';').map(c => c.trim())
          .filter(c => /^(taskmall_session|taskora_session)=/.test(c));
        if (cookies.length) headers.cookie = cookies.join('; ');
        const request = (upstream.protocol === 'https:' ? https : http).request(new URL(url.pathname + url.search, upstream),
          { method: req.method, headers }, response => {
            request.setTimeout(0);
            if (response.statusCode >= 300 && response.statusCode < 400) {
              response.resume(); return json(res, 502, 'BACKEND_REDIRECT_REFUSED');
            }
            for (const name of ['content-type', 'retry-after']) if (response.headers[name]) res.setHeader(name, response.headers[name]);
            const setCookies = (response.headers['set-cookie'] || []).filter(c => /^(taskmall_session|taskora_session)=/.test(c))
              .map(c => c.replace(/;\s*Secure(?=;|$)/gi, '').replace(/;\s*Domain=[^;]*/gi, ''));
            if (setCookies.length) res.setHeader('Set-Cookie', setCookies);
            res.writeHead(response.statusCode);
            response.on('error', () => res.destroy());
            response.pipe(res);
            res.on('close', () => response.destroy());
          });
        request.setTimeout(25_000, () => request.destroy(new Error('TIMEOUT')));
        request.on('error', () => json(res, 502, 'BACKEND_UNAVAILABLE'));
        req.on('aborted', () => request.destroy());
        res.on('close', () => request.destroy());
        let size = 0;
        req.on('data', data => {
          size += data.length;
          if (size > 1_000_000) { json(res, 413, 'BODY_TOO_LARGE'); request.destroy(); }
        });
        req.pipe(request);
        return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, 'METHOD_NOT_ALLOWED');
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.includes('\\') || pathname.split('/').some(p => p.startsWith('.'))) return json(res, 404, 'NOT_FOUND');
      let filename = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!filename.startsWith(root + path.sep)) return json(res, 404, 'NOT_FOUND');
      try { filename = await fs.realpath(filename); }
      catch (error) {
        if (error.code !== 'ENOENT' || path.extname(pathname) || pathname.startsWith('/operator')) return json(res, 404, 'NOT_FOUND');
        filename = path.join(root, 'index.html');
      }
      if (!filename.startsWith(root + path.sep)) return json(res, 404, 'NOT_FOUND');
      const body = await fs.readFile(filename);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filename)] || 'application/octet-stream', 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { json(res, 404, 'NOT_FOUND'); }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  return server;
}

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_PROJECT_ID) throw new Error('LOCAL_GATEWAY_ONLY');
  const config = await railwayReviewConfiguration();
  const response = await fetch(config.origin + '/api/me', {
    headers: { [REVIEW_HEADER]: config.token }, signal: AbortSignal.timeout(15_000), redirect: 'error'
  });
  const body = await response.json();
  if (response.status !== 401 || body.error !== 'AUTH_REQUIRED') throw new Error('BACKEND_REVIEW_NOT_READY');
  const port = Number(process.env.PORT || 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('INVALID_LOCAL_PORT');
  const server = createLocalLiveServer(config);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  console.log(`Portgainy local: http://127.0.0.1:${server.address().port}`);
  console.log('Backend: existing Railway application. Database: existing Railway MySQL. No local database.');
  const stop = () => { server.closeAllConnections(); server.close(() => process.exit(0)); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  return server;
}

function reportStartupError(error) {
  const allowed = ['RAILWAY_IDENTITY_REQUIRED', 'RAILWAY_LOCAL_REVIEW_UNAVAILABLE', 'BACKEND_REVIEW_NOT_READY', 'LOCAL_GATEWAY_ONLY', 'INVALID_LOCAL_PORT', 'EADDRINUSE'];
  const code = allowed.includes(error.code || error.message) ? error.code || error.message : 'LOCAL_BACKEND_CONNECTION_FAILED';
  console.error('Portgainy local startup:', code); process.exitCode = 1;
}

if (require.main === module) main().catch(reportStartupError);
module.exports = { createLocalLiveServer, railwayReviewConfiguration, main, reportStartupError };
