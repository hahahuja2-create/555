'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { validateCatalog } = require('./check-locale-catalog.cjs');

function reviewDigest(source, translation) {
  return crypto.createHash('sha256').update(source).update('\0').update(translation).digest('hex');
}

function validateRelease(source, catalog, review) {
  const problems = validateCatalog(source, catalog);
  if (!review || typeof review !== 'object' || typeof review.reviewer !== 'string' || !review.reviewer.trim() || !review.entries || typeof review.entries !== 'object') {
    problems.push('Review metadata is missing');
    return problems;
  }
  for (const key of Object.keys(source)) {
    if (typeof catalog[key] === 'string' && review.entries[key] !== reviewDigest(source[key], catalog[key])) problems.push(`${key}: translation has not been reviewed at this revision`);
  }
  return problems;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const { PG_READY_LANGUAGES } = require('../public/pg-i18n');
  const enabled = PG_READY_LANGUAGES.filter(code => code !== 'en');
  if (!enabled.length) console.log('Only English is enabled; no translated catalog is being released.');
  else {
    try {
      const source = JSON.parse(fs.readFileSync(path.join(root,'localization','source.en.json'),'utf8'));
      const coverage = JSON.parse(fs.readFileSync(path.join(root,'localization','coverage.json'),'utf8'));
      if (coverage.complete !== true) throw new Error('Application text coverage is not complete.');
      for (const code of enabled) {
        const catalog = JSON.parse(fs.readFileSync(path.join(root,'public','locales',`${code}.json`),'utf8'));
        const review = JSON.parse(fs.readFileSync(path.join(root,'localization','reviews',`${code}.json`),'utf8'));
        const issues = validateRelease(source,catalog,review);
        if (issues.length) throw new Error(`${code}: ${issues.length} unresolved catalog or review issues\n${issues.slice(0,20).join('\n')}`);
      }
      console.log(`Validated ${enabled.length} reviewed language catalogs.`);
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}

module.exports = { reviewDigest, validateRelease };
