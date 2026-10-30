'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'artifacts');
fs.mkdirSync(out, { recursive: true });
const stdout = fs.openSync(path.join(out, 'portgainy-local.stdout.log'), 'a');
const stderr = fs.openSync(path.join(out, 'portgainy-local.stderr.log'), 'a');
const child = spawn(process.execPath, ['--env-file-if-exists=.env', 'scripts/local-live.cjs'], {
  cwd: root, detached: true, windowsHide: true, stdio: ['ignore', stdout, stderr]
});
fs.closeSync(stdout); fs.closeSync(stderr);
child.unref();
fs.writeFileSync(path.join(out, 'portgainy-local.pid'), String(child.pid));
console.log(`Portgainy local gateway starting (PID ${child.pid}). Open http://127.0.0.1:4173.`);
console.log('Uses the existing Railway backend and database. Startup status: artifacts/portgainy-local.stdout.log');
