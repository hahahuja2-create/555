'use strict';

// Collects explicitly localized interface messages. This is a work-in-progress
// inventory, not proof that all rendered application text has been migrated.
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');
const root = path.resolve(__dirname, '..');
const files = ['pg-core.js','pg-notice.js','pg-views.js','pg-trade.js','pg-more.js','pg-main.js','pg-forge.js','pg-landing.js','pg-app-phone.js'];
const messages = new Map();
const examples = new Map();

function record(value, origin) {
  if (typeof value !== 'string' || !value.trim()) return;
  let references = messages.get(value);
  if (!references) messages.set(value, references = new Set());
  references.add(origin);
}
function collectLiterals(node, origin) {
  if (!node) return;
  if (node.type === 'Literal' && typeof node.value === 'string') record(node.value, origin);
  else if (node.type === 'ConditionalExpression') { collectLiterals(node.consequent, origin); collectLiterals(node.alternate, origin); }
  else if (node.type === 'LogicalExpression') { collectLiterals(node.left, origin); collectLiterals(node.right, origin); }
}
function recordExample(source, node, origin) {
  if (source?.type !== 'Literal' || typeof source.value !== 'string' || node?.type !== 'ObjectExpression') return;
  const values = {};
  for (const property of node.properties) {
    if (property.type !== 'Property' || property.computed) continue;
    const name = property.key.name || property.key.value;
    values[name] = property.value.type === 'Literal' ? String(property.value.value) : '<runtime value>';
  }
  let entries = examples.get(source.value);
  if (!entries) examples.set(source.value, entries = []);
  entries.push({location:origin,placeholders:values});
}
function arrayStrings(node, origin, index) {
  if (node?.type !== 'ArrayExpression') return;
  for (const row of node.elements) {
    if (row?.type !== 'ArrayExpression') continue;
    if (index == null) for (const value of row.elements) collectLiterals(value, origin);
    else collectLiterals(row.elements[index], origin);
  }
}
function visit(node, file) {
  if (!node || typeof node !== 'object') return;
  const origin = `${file}:${node.loc?.start.line || 1}`;
  if (node.type === 'CallExpression') {
    const callee = node.callee;
    if (callee.type === 'MemberExpression' && !callee.computed && callee.object.type === 'Identifier' && callee.object.name === 'i18n' && ['text','html','rich'].includes(callee.property.name)) {
      collectLiterals(node.arguments[0], origin);
      recordExample(node.arguments[0], node.arguments[1], origin);
    }
    if (callee.type === 'Identifier') {
      const localizedAlias=(file.endsWith('pg-forge.js')&&callee.name==='text')||(file.endsWith('pg-landing.js')&&callee.name==='lt');
      const indexes = {sectionHead:[0],section:[0],entry:[0,2],moreLink:[0],sheetHead:[0,1],emptyState:[1,2],unavailable:[0],toast:[0,2]}[callee.name] || (localizedAlias?[0]:[]);
      for (const index of indexes) collectLiterals(node.arguments[index], origin);
      if (callee.name === 'openSheet' && node.arguments[1]?.type === 'ObjectExpression') {
        const label = node.arguments[1].properties.find(property => !property.computed && (property.key?.name || property.key?.value) === 'label');
        if (label) collectLiterals(label.value, origin);
      }
    }
    if (callee.type === 'MemberExpression' && !callee.computed && callee.property.name === 'map' && callee.object.type === 'ArrayExpression') {
      const elements = callee.object.elements;
      if (elements.length && elements.every(element => element?.type === 'Literal' && typeof element.value === 'string' && /\?/.test(element.value))) for (const element of elements) collectLiterals(element, origin);
    }
  }
  if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
    const name = node.id.name;
    if (name === 'NAV' || name === 'RAIL_EXTRA' || name === 'PAGES') arrayStrings(node.init, origin, 1);
    const positions = {facts:[1],products:[1,2],steps:[0,1],accounts:[0,1,2],limits:[0,1],safety:[1,2]}[name];
    if (positions) for (const index of positions) arrayStrings(node.init, origin, index);
    if (name === 'metrics' || name === 'tabs') arrayStrings(node.init, origin, name === 'metrics' ? 0 : 1);
    if (name === 'FAQ' || (file.endsWith('pg-forge.js')&&name==='faq')) {
      arrayStrings(node.init, origin, null);
      for (const row of node.init?.elements || []) if (row?.type === 'ArrayExpression') recordExample(row.elements[1], row.elements[2], origin);
    }
    if (['ERRORS','TITLES','WITHDRAW_STATUS'].includes(name) && node.init?.type === 'ObjectExpression') for (const property of node.init.properties) collectLiterals(property.value, origin);
    if (['issue','payoutIssue','collectionIssue'].includes(name) && node.init?.type === 'MemberExpression' && node.init.object?.type === 'ObjectExpression') for (const property of node.init.object.properties) collectLiterals(property.value, origin);
  }
  for (const [key, value] of Object.entries(node)) {
    if (['loc','start','end'].includes(key)) continue;
    if (Array.isArray(value)) { for (const child of value) if (child && typeof child === 'object') visit(child, file); }
    else if (value && typeof value === 'object') visit(value, file);
  }
}

for (const file of files) {
  const source = fs.readFileSync(path.join(root,'public',file),'utf8');
  visit(acorn.parse(source,{ecmaVersion:'latest',locations:true}),`public/${file}`);
}
const marketFile = 'markets/binance.js';
const marketSource = fs.readFileSync(path.join(root,marketFile),'utf8');
const marketAst = acorn.parse(marketSource,{ecmaVersion:'latest',locations:true});
for (const statement of marketAst.body) {
  if (statement.type !== 'VariableDeclaration') continue;
  const declaration = statement.declarations.find(item => item.id?.name === 'CATALOG');
  if (declaration) arrayStrings(declaration.init, `${marketFile}:${declaration.loc.start.line}`, 2);
}
record('Other', `${marketFile}:other`);
// Strings that are composed or passed through helper functions (phone tiles, transaction rows, About copy) cannot be
// found by the syntax walk above; they are listed here so they are inventoried and validated like every other message.
const extraFile = path.join(root,'localization','source-extra.json');
if (fs.existsSync(extraFile)) for (const value of JSON.parse(fs.readFileSync(extraFile,'utf8'))) record(value, 'localization/source-extra.json');
const ordered = [...messages.keys()].sort((a,b)=>a.localeCompare(b,'en'));
const english = Object.fromEntries(ordered.map(value => [value,value]));
const contexts = Object.fromEntries(ordered.map(value => [value,{locations:[...messages.get(value)].sort(), examples:examples.get(value) || []}]));
const directory = path.join(root,'localization');
fs.mkdirSync(directory,{recursive:true});
fs.writeFileSync(path.join(directory,'source.en.json'),JSON.stringify(english,null,2)+'\n');
fs.writeFileSync(path.join(directory,'source-contexts.json'),JSON.stringify(contexts,null,2)+'\n');
console.log(`Extracted ${ordered.length} explicitly localized messages; more interface text may remain unconverted.`);
