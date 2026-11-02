'use strict';

// Checks catalog completeness and interpolation safety; it cannot judge translation quality.
function placeholders(text) {
  return [...String(text).matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(match => match[1]).sort();
}

function validEmphasis(text) {
  let open = null;
  for (const match of text.matchAll(/\{(strongStart|strongEnd|timerStart|timerEnd)\}/g)) {
    const name = match[1];
    if (name.endsWith('Start')) { if (open) return false; open = name.slice(0,-5); }
    else { if (!open || name !== `${open}End`) return false; open = null; }
  }
  return open === null;
}

function numericValues(text) {
  const starts = [0x0660, 0x06f0, 0x0966, 0x09e6, 0x0e50];
  const ascii = String(text).replace(/\{[A-Za-z][A-Za-z0-9_]*\}/g, '').replace(/[٠-٩۰-۹०-९০-৯๐-๙]/g, digit => {
    const point = digit.codePointAt(0), start = starts.find(base => point >= base && point < base + 10);
    return String(point - start);
  });
  return (ascii.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || []).map(value => value.replaceAll(',', '')).sort();
}

function validateCatalog(source, target) {
  if (!source || !target || Array.isArray(source) || Array.isArray(target) || typeof source !== 'object' || typeof target !== 'object') throw new Error('Catalogs must be objects');
  const problems = [];
  for (const [key, original] of Object.entries(source)) {
    const translation = target[key];
    if (typeof original !== 'string') { problems.push(`${key}: invalid source`); continue; }
    if (typeof translation !== 'string' || !translation.trim()) { problems.push(`${key}: missing translation`); continue; }
    const before = placeholders(original), after = placeholders(translation);
    if (before.length !== after.length || before.some((value, index) => value !== after[index])) problems.push(`${key}: placeholders differ`);
    else if (!validEmphasis(original) || !validEmphasis(translation)) problems.push(`${key}: invalid emphasis`);
    const numbers = numericValues(original), translatedNumbers = numericValues(translation);
    if (numbers.length !== translatedNumbers.length || numbers.some((value, index) => value !== translatedNumbers[index])) problems.push(`${key}: numeric values differ`);
  }
  for (const key of Object.keys(target)) if (!Object.hasOwn(source, key)) problems.push(`${key}: unknown key`);
  return problems;
}

if (require.main === module) {
  const fs = require('node:fs');
  if (process.argv.length !== 4) { console.error('Usage: node scripts/check-locale-catalog.cjs <source.json> <locale.json>'); process.exitCode = 2; }
  else {
    try {
      const source = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
      const locale = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
      const problems = validateCatalog(source, locale);
      if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
      else console.log(`Catalog structure is valid for ${Object.keys(source).length} messages. Translation still requires linguistic review.`);
    } catch (error) { console.error(error.message); process.exitCode = 2; }
  }
}

module.exports = { validateCatalog };
