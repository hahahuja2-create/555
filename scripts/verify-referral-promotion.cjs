'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const promotion = require('../markets/referral-promotion');
const earn = require('../markets/earn');
const { units } = require('../payments/tron');
const launch = Date.parse('2026-10-25T11:00:00Z');
const key = () => crypto.randomUUID();
function user(id, ref = null, balance = 100) {
  return { id, inviteCode: 'CODE' + id, referredBy: ref, createdAt: new Date(launch - 3 * earn.DAY).toISOString(),
    lockedBalance: balance, withdrawBalance: 0, earnedTotal: 0, activities: [] };
}
function deposit(id, value = '50', at = launch - earn.DAY, suffix = '') {
  return { user_id: id, amount_units: units(value).toString(), timestamp: at,
    txid: crypto.createHash('sha256').update(id + suffix).digest('hex'), log_index: 0 };
}
function fixture(count = 10) {
  const owner = user('owner'), friends = Array.from({ length: count }, (_, i) => user('friend' + i, owner.inviteCode));
  const state = { users: [owner, ...friends] };
  earn.pool(state, launch - earn.DAY);
  promotion.initialize(state, friends.map(friend => deposit(friend.id)), launch);
  return { state, owner, friends };
}

test('existing verified referrals unlock 15% immediately without changing balances or history', () => {
  const { state, owner } = fixture();
  const view = promotion.snapshot(state, owner, launch);
  assert.equal(view.qualifyingReferrals, 10);
  assert.equal(view.status, 'unlocked');
  assert.equal(view.unlockedAt, launch);
  assert.equal(earn.snapshot(state, owner, launch, true).rate, .15);
  assert.equal(earn.snapshot(state, owner, launch, true).nextReward, 15);
  assert.equal(owner.lockedBalance, 100);
  assert.equal(owner.withdrawBalance, 0);
  assert.deepEqual(owner.activities, []);
});

test('nine referrals keep 10%; only direct, distinct funded accounts count', () => {
  const { state, owner, friends } = fixture(9);
  const secondLevel = user('second', friends[0].inviteCode);
  promotion.hydrateUser(secondLevel, [deposit(secondLevel.id)]);
  state.users.push(secondLevel, { ...friends[0] });
  owner.referredBy = owner.inviteCode;
  promotion.hydrateUser(owner, [deposit(owner.id)]);
  assert.equal(promotion.snapshot(state, owner, launch).activeReferrals, 9);
  assert.equal(earn.snapshot(state, owner, launch, true).rate, .1);
});

test('50 USDT is cumulative and exact; balance, internal transfers and rewards cannot substitute for deposits', () => {
  const { state, owner, friends } = fixture(9);
  const friend = user('split', owner.inviteCode, 5000);
  friend.activities = [{ type: 'transfer', amount: 5000 }, { type: 'referral', amount: 50 }];
  state.users.push(friend);
  promotion.hydrateUser(friend, [deposit(friend.id, '25'), deposit(friend.id, '24.999999', launch, 'second')]);
  assert.equal(promotion.snapshot(state, owner, launch).qualifyingReferrals, 9);
  promotion.hydrateUser(friend, [deposit(friend.id, '25'), deposit(friend.id, '25', launch, 'second')]);
  friend.lockedBalance = 0;
  assert.equal(promotion.snapshot(state, owner, launch).qualifyingReferrals, 10);
  assert.equal(friends.length, 9);
});

test('existing accounts start at launch; later signups receive their own complete ten days', () => {
  const { state, owner } = fixture(0);
  const later = { ...user('later'), createdAt: new Date(launch + earn.DAY).toISOString() };
  state.users.push(later);
  assert.equal(promotion.snapshot(state, owner, launch).expiresAt, launch + 10 * earn.DAY);
  assert.equal(promotion.snapshot(state, later, launch + earn.DAY).expiresAt, launch + 11 * earn.DAY);
  const persisted = JSON.parse(JSON.stringify(state));
  assert.equal(promotion.initialize(persisted, [], launch + 5 * earn.DAY), false);
  assert.equal(promotion.snapshot(persisted, persisted.users[0], launch + 5 * earn.DAY).startsAt, launch);
});

test('meeting the target before expiry keeps 15% permanently even without a visit during the offer', () => {
  const { state, owner, friends } = fixture();
  promotion.hydrateUser(friends[9], [deposit(friends[9].id, '50', launch + 10 * earn.DAY - 1)]);
  assert.equal(promotion.snapshot(state, owner, launch).status, 'active');
  const later = launch + 100 * earn.DAY;
  assert.equal(promotion.snapshot(state, owner, later).status, 'unlocked');
  assert.equal(earn.claim(state, owner.id, key(), later).receipt.amount, 15);
});

test('a tenth referral at or after the deadline cannot unlock a late bonus', () => {
  for (const delay of [0, 1, earn.DAY]) {
    const { state, owner, friends } = fixture();
    promotion.hydrateUser(friends[9], [deposit(friends[9].id, '50', launch + 10 * earn.DAY + delay)]);
    const view = promotion.snapshot(state, owner, launch + 11 * earn.DAY);
    assert.equal(view.status, 'expired');
    assert.equal(view.qualifyingReferrals, 9);
    assert.equal(view.activeReferrals, 10);
    assert.equal(earn.snapshot(state, owner, launch + 11 * earn.DAY, true).rate, .1);
  }
});

test('boosted claims preserve six-decimal rounding, principal and existing 10% / 5% referral commissions', () => {
  const { state, owner } = fixture();
  const parent = user('parent'), grandparent = user('grandparent');
  owner.referredBy = parent.inviteCode;
  parent.referredBy = grandparent.inviteCode;
  owner.lockedBalance = 30.430007;
  state.users.push(parent, grandparent);
  const receipt = earn.claim(state, owner.id, key(), launch).receipt;
  assert.equal(receipt.amount, 4.564501);
  assert.equal(receipt.rate, .15);
  assert.equal(owner.lockedBalance, 30.430007);
  assert.equal(parent.withdrawBalance, .45645);
  assert.equal(grandparent.withdrawBalance, .228225);
  assert.equal(owner.activities[0].rate, 15);
  assert.equal(state.earn.totalAccruedUnits, '5249176');
});

test('an upgrade cannot repeat a daily claim or rewrite an earlier idempotent receipt', () => {
  const { state, owner } = fixture(9);
  const original = key();
  assert.equal(earn.claim(state, owner.id, original, launch).receipt.amount, 10);
  const friend = user('last', owner.inviteCode);
  promotion.hydrateUser(friend, [deposit(friend.id, '50', launch + 1000)]);
  state.users.push(friend);
  assert.equal(earn.claim(state, owner.id, original, launch + 1000).receipt.amount, 10);
  assert.throws(() => earn.claim(state, owner.id, key(), launch + 1000), /EARN_COOLDOWN/);
  assert.equal(earn.claim(state, owner.id, key(), earn.nextReset(launch)).receipt.amount, 15);
});

test('historical deposits are sorted, deduplicated and retain the correct 50-USDT threshold time', () => {
  const u = user('history');
  const a = deposit(u.id, '20', launch - 2000, 'a');
  const b = deposit(u.id, '30', launch - 1000, 'b');
  promotion.hydrateUser(u, [deposit(u.id, '10', launch, 'c'), b, a, b]);
  assert.equal(u.verifiedReferralDeposits.totalUnits, '60000000');
  assert.equal(u.verifiedReferralDeposits.activeAt, launch - 1000);
  assert.throws(() => promotion.hydrateUser(u, [{ ...a, amount_units: '-1' }]), /INVALID_PROMOTION_DEPOSIT/);
  assert.throws(() => promotion.hydrateUser(u, [{ ...a, txid: 'unverified' }]), /INVALID_PROMOTION_DEPOSIT/);
});

test('one announcement per account persists across sessions, devices and restarts', () => {
  const { state, owner, friends } = fixture();
  assert.equal(promotion.claimAnnouncement(state, owner, launch).show, true);
  assert.equal(promotion.claimAnnouncement(state, owner, launch + 1).show, false);
  const saved = JSON.parse(JSON.stringify(state));
  assert.equal(promotion.claimAnnouncement(saved, saved.users[0], launch + earn.DAY).show, false);
  assert.equal(promotion.claimAnnouncement(state, friends[0], launch).show, true);
});
