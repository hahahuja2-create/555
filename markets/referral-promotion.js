'use strict';

const { units } = require('../payments/tron');
const DAY = 86_400_000;
const ID = 'active-referrals-15-v1';
const REQUIRED = 10;
const MINIMUM = 50_000_000n;

// This counter is rebuilt exclusively from the verified deposit ledger, never balances or rewards.
function hydrateUser(user, rows) {
  let total = 0n, activeAt = null;
  const seen = new Set();
  const deposits = rows.map(row => ({ ...row, timestamp: Number(row.timestamp) }))
    .sort((a, b) => a.timestamp - b.timestamp);
  for (const row of deposits) {
    const key = row.txid + ':' + row.log_index;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!/^[a-f0-9]{64}$/.test(row.txid || '') || !Number.isSafeInteger(row.timestamp) || row.timestamp <= 0
      || !/^\d+$/.test(String(row.amount_units)) || BigInt(row.amount_units) <= 0n) throw new Error('INVALID_PROMOTION_DEPOSIT');
    total += BigInt(row.amount_units);
    if (activeAt === null && total >= MINIMUM) activeAt = row.timestamp;
  }
  user.verifiedReferralDeposits = { version: 1, totalUnits: total.toString(), activeAt };
}

function initialize(state, rows = [], now = Date.now()) {
  if (!state.earn) throw new Error('EARN_UNAVAILABLE');
  const current = state.earn.referralPromotion;
  if (current) {
    if (current.id !== ID || current.version !== 1 || !Number.isSafeInteger(current.launchedAt)
      || current.launchedAt <= 0 || current.depositBackfillVersion !== 1) throw new Error('INVALID_REFERRAL_PROMOTION');
    return false;
  }
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.user_id)) grouped.set(row.user_id, []);
    grouped.get(row.user_id).push(row);
  }
  for (const user of state.users) hydrateUser(user, grouped.get(user.id) || []);
  state.earn.referralPromotion = { id: ID, version: 1, launchedAt: now, depositBackfillVersion: 1 };
  return true;
}

function snapshot(state, user, now = Date.now()) {
  const campaign = state.earn?.referralPromotion;
  if (!campaign) return null;
  const registered = Date.parse(user.createdAt);
  const startsAt = Math.max(campaign.launchedAt, Number.isFinite(registered) ? registered : campaign.launchedAt);
  const expiresAt = startsAt + 10 * DAY;
  const active = new Map();
  for (const member of state.users) {
    if (member.id === user.id || !user.inviteCode || member.referredBy !== user.inviteCode) continue;
    const deposits = member.verifiedReferralDeposits;
    if (deposits?.version !== 1 || !/^\d+$/.test(deposits.totalUnits || '') || BigInt(deposits.totalUnits) < MINIMUM
      || !Number.isSafeInteger(deposits.activeAt) || deposits.activeAt > now) continue;
    active.set(member.id, deposits.activeAt);
  }
  // Historical threshold times preserve an earned upgrade even if the owner returns after the deadline.
  const qualifying = [...active.values()].filter(at => at < expiresAt).sort((a, b) => a - b);
  const unlockedAt = qualifying.length >= REQUIRED ? Math.max(startsAt, qualifying[REQUIRED - 1]) : null;
  const unlocked = unlockedAt !== null && now >= unlockedAt;
  return { id: campaign.id, durationDays: 10, requiredReferrals: REQUIRED, minimumDepositUSDT: 50,
    startsAt, expiresAt, activeReferrals: active.size, qualifyingReferrals: qualifying.length, unlockedAt,
    status: unlocked ? 'unlocked' : now >= expiresAt ? 'expired' : 'active',
    baseRate: 0.1, boostedRate: 0.15, rate: unlocked ? 0.15 : 0.1,
    announcementPending: user.referralPromotionAnnouncement?.id !== campaign.id };
}

function rateBps(state, user, now = Date.now()) {
  return snapshot(state, user, now)?.status === 'unlocked' ? 1500 : 1000;
}

function rewardUnits(state, user, now = Date.now()) {
  return units(user.lockedBalance) * BigInt(rateBps(state, user, now)) / 10_000n;
}

function claimAnnouncement(state, user, now = Date.now()) {
  const promotion = snapshot(state, user, now);
  if (!promotion || !promotion.announcementPending) return { show: false, promotion };
  user.referralPromotionAnnouncement = { id: promotion.id, shownAt: now };
  return { show: true, promotion: snapshot(state, user, now) };
}

module.exports = { ID, DAY, initialize, hydrateUser, snapshot, rateBps, rewardUnits, claimAnnouncement };
