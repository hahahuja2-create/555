'use strict';
const { units, amount } = require('./tron');

// Prepare an auditable account credit and keep the presentation offset separate
// from actual earnings. The caller commits while holding the application lock.
function prepare(state, { userId, expectedEarn, expectedEarned, targetEarn, targetDisplayEarned, operationId, at }) {
  if (!/^[a-f0-9-]{36}$/.test(userId || '') || !/^[a-f0-9-]{36}$/.test(operationId || '') || !Number.isFinite(Date.parse(at))) throw Error('INVALID_ADJUSTMENT');
  const matches = (state?.users || []).filter(user => user.id === userId);
  if (matches.length !== 1) throw Error('ACCOUNT_IDENTITY_MISMATCH');
  const current = matches[0], before = units(current.lockedBalance || 0), earned = units(current.earnedTotal || 0);
  const desired = units(targetEarn), display = units(targetDisplayEarned);
  if (before !== units(expectedEarn) || earned !== units(expectedEarned)) throw Error('ACCOUNT_CHANGED');
  if (desired < before || display < earned || current.earnMinimum?.version === 1) throw Error('ADJUSTMENT_REQUIRES_REVIEW');
  if (current.manualEarnedDisplay) throw Error('DISPLAY_ADJUSTMENT_EXISTS');
  const next = structuredClone(state), user = next.users.find(item => item.id === userId), credit = desired - before;
  user.lockedBalance = amount(desired);
  user.manualEarnedDisplay = { operationId, offsetUnits:(display-earned).toString(), at };
  if (credit) (user.activities ||= []).unshift({ id:operationId, at, type:'adjustment', amount:amount(credit),
    source:'operator-manual-earn-credit', balanceBefore:amount(before), balanceAfter:amount(desired) });
  return { state:next, creditUnits:credit.toString(), offsetUnits:(display-earned).toString() };
}

function displayedEarned(user) {
  const offset=user.manualEarnedDisplay?.offsetUnits;
  if (offset === undefined) return null;
  if (typeof offset !== 'string' || !/^\d+$/.test(offset)) throw Error('INVALID_DISPLAY_ADJUSTMENT');
  return amount(units(user.earnedTotal || 0) + BigInt(offset));
}

module.exports = { prepare, displayedEarned };
