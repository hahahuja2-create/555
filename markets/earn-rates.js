'use strict';
const TIERS = Object.freeze([
  { minimum:200, maximum:500, bps:800 },
  { minimum:500, maximum:1000, bps:900 },
  { minimum:1000, maximum:1700, bps:1000 },
  { minimum:1700, maximum:2500, bps:1100 },
  { minimum:2500, maximum:4000, bps:1200 },
  { minimum:4000, maximum:null, bps:1300 }
].map(Object.freeze));
const NOTICE_VERSION = 'earn-tiers-2026-10-v1';
function rateBps(balanceUnits) {
  const balance = BigInt(balanceUnits);
  return [...TIERS].reverse().find(t => balance >= BigInt(t.minimum)*1_000_000n)?.bps ?? TIERS[0].bps;
}
module.exports = {TIERS, NOTICE_VERSION, rateBps};
