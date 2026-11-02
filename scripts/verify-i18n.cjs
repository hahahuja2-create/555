'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createPortgainyI18n } = require('../public/pg-i18n');
const languages = require('../public/pg-languages');
const { MysqlPaymentStore } = require('../payments/mysql-store');
const { validateCatalog } = require('./check-locale-catalog.cjs');
const { reviewDigest, validateRelease } = require('./check-i18n-release.cjs');

test('language identifiers are unique and default to English', () => {
  assert.ok(languages.length >= 25);
  assert.equal(languages[0].code, 'en');
  assert.equal(new Set(languages.map(item => item.code)).size, languages.length);
  for (const language of languages) {
    assert.match(language.code, /^[a-z]{2}(?:-[A-Z]{2})?$/);
    assert.ok(language.name.trim());
  }
});

test('catalogs preserve values, reject damaged placeholders, and escape HTML', async () => {
  const source = 'Send {amount} USDT to {address}';
  const i18n = createPortgainyI18n(languages, async () => ({
    [source]: '{address}: გაგზავნეთ {amount} USDT',
    'Fee: {fee}%': 'საკომისიო',
    'Minimum 10 USDT': 'მინიმუმ 100 USDT'
  }));
  assert.equal(i18n.language, 'en');
  assert.equal(i18n.text(source, { amount: '12.34', address: 'TExample' }), 'Send 12.34 USDT to TExample');
  await i18n.use('ka');
  assert.equal(i18n.text(source, { amount: '12.34', address: 'TExample' }), 'TExample: გაგზავნეთ 12.34 USDT');
  assert.equal(i18n.text('Fee: {fee}%', {fee:'2'}), 'Fee: 2%');
  assert.equal(i18n.text('Minimum 10 USDT'), 'Minimum 10 USDT');
  assert.match(i18n.html(source, { amount: '<1>', address: 'T&X' }), /T&amp;X.*&lt;1&gt;/);
  await assert.rejects(i18n.use('not-supported'), /Unsupported/);
  assert.equal(i18n.language, 'ka');
});

test('rich translations can move safe emphasis around text without injecting markup', async () => {
  const source = 'Send {strongStart}{amount} USDT{strongEnd} to {address}.';
  const i18n = createPortgainyI18n(languages, async () => ({
    [source]: '{address}: {strongStart}{amount} USDT{strongEnd} <script>bad</script>',
    '{strongStart}Safe{strongEnd}': '{strongEnd}Unsafe{strongStart}'
  }));
  await i18n.use('ka');
  assert.equal(i18n.rich(source, {amount:'12.5',address:'T<&'}), 'T&lt;&amp;: <b>12.5 USDT</b> &lt;script&gt;bad&lt;/script&gt;');
  assert.equal(i18n.rich('{strongStart}Safe{strongEnd}'), '<b>Safe</b>');
  assert.equal(i18n.rich('Next in {timerStart}{time}{timerEnd}', {time:'01:02:03'}), 'Next in <b data-earn-timer>01:02:03</b>');
});

test('right-to-left translations isolate account values and identifiers', async () => {
  const source = 'Send {amount} to {address}';
  const i18n = createPortgainyI18n(languages, async () => ({[source]:'أرسل {amount} إلى {address}'}));
  await i18n.use('ar');
  assert.equal(i18n.text(source, {amount:'12.5 USDT',address:'T123'}), 'أرسل \u206812.5 USDT\u2069 إلى \u2068T123\u2069');
});

test('a slow catalog cannot override a newer choice and failed loading keeps current language', async () => {
  let resolveSlow;
  const i18n = createPortgainyI18n(languages, code => code === 'ka'
    ? new Promise(resolve => { resolveSlow = resolve; })
    : Promise.reject(new Error('not available')));
  const slow = i18n.use('ka');
  assert.equal(await i18n.use('en'), true);
  resolveSlow({ Home: 'მთავარი' });
  assert.equal(await slow, false);
  assert.equal(i18n.language, 'en');
  await assert.rejects(i18n.use('fr'), /not available/);
  assert.equal(i18n.language, 'en');
});

test('saving only a language preference does not create balance movements', async () => {
  const writes = [], projected = [];
  const store = new MysqlPaymentStore({ on() {} });
  const user = { id: 'fixture-user', lockedBalance: 406.2, withdrawBalance: 3.25, reservedBalance: 1.5 };
  store.inTransaction = true;
  store.state = async () => ({users:[user]});
  store.projectUser = async value => projected.push(value);
  store.execute = async (query, parameters) => { writes.push({query,parameters}); };
  await store.saveInside({users:[{...user, language:'ka'}]}, 'language-preference');
  assert.equal(projected.length, 1);
  assert.equal(writes.some(item => item.query.startsWith('INSERT INTO journal')), false);
  const state = writes.find(item => item.query.startsWith('INSERT INTO state'));
  assert.equal(JSON.parse(state.parameters[0]).users[0].language, 'ka');
  assert.equal(JSON.parse(state.parameters[0]).users[0].lockedBalance, 406.2);
});

test('catalog audit catches missing messages and changed or repeated placeholders', () => {
  const source = { a:'Send {amount} USDT to {address}', b:'Fee {fee}%, total {fee}%' };
  assert.deepEqual(validateCatalog(source, {a:'{address}: {amount} USDT', b:'{fee}% / {fee}%'}), []);
  const problems = validateCatalog(source, {a:'{address}: USDT', b:'{fee}%', extra:'unused'});
  assert.equal(problems.length, 3);
  assert.ok(problems.some(item => item.includes('a: placeholders')));
  assert.ok(problems.some(item => item.includes('b: placeholders')));
  assert.ok(problems.some(item => item.includes('extra: unknown')));
  assert.ok(validateCatalog(source, {a:'{address}: {amount} USDT'}).some(item => item.includes('b: missing')));
  assert.deepEqual(validateCatalog({c:'{strongStart}Safe{strongEnd}'}, {c:'{strongEnd}Unsafe{strongStart}'}), ['c: invalid emphasis']);
  assert.deepEqual(validateCatalog({c:'Minimum 200 USDT, fee 2%'}, {c:'الحد ٢٠٠ USDT، الرسوم ٢%'}), []);
  assert.deepEqual(validateCatalog({c:'Minimum 200 USDT, fee 2%'}, {c:'Minimum 200 USDT, fee 5%'}), ['c: numeric values differ']);
});

test('release checks require a review of the exact source and translation', () => {
  const source={a:'Fee: {amount} USDT'}, catalog={a:'საკომისიო: {amount} USDT'};
  assert.ok(validateRelease(source,catalog,null).includes('Review metadata is missing'));
  const review={reviewer:'fixture reviewer',entries:{a:reviewDigest(source.a,catalog.a)}};
  assert.deepEqual(validateRelease(source,catalog,review),[]);
  assert.ok(validateRelease(source,{a:'საკომისიო: {amount} USDT შეიცვალა'},review).some(item=>item.includes('not been reviewed')));
});
