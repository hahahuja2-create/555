# Portgainy Forge

Forge replaces balance-tier Earn with internal virtual collectibles. It uses the
existing database and USDT accounting. It does not mint NFTs, provide physical
hashrate, change signers or create a new withdrawal pipeline.

## Wallet conversion

`PORTGAINY_FORGE_ENABLED=1` activates Forge. Startup combines each account's Earn
and Spot amounts into `withdrawBalance` once and sets `lockedBalance` to zero.
Existing pending withdrawals remain reserved for their existing requests. The
migration validates all sums before changing records and persists a per-user
conversion marker in the same database transaction. No balance top-up is applied.
An existing Forge database refuses to start with the flag disabled; rollback
requires an explicit accounting plan rather than silently restoring split funds.

Confirmed TRC20 deposits below 10 USDT remain recorded in the existing deposit
ledger. Their amounts accumulate per user until at least 10 USDT is reached, then
the full accumulated amount credits the available wallet. Existing deposit
transaction/event uniqueness checks prevent duplicate credits. Collections and
automatic withdrawals continue using the existing working wallet and signer.

## Collection and program

The nine initial Cores span 1–250 virtual TH/s and 30–14 virtual W/TH. Their prices
range from 10 to 2,500 USDT. Power upgrades cost 9.50 USDT per additional TH/s;
efficiency improvements cost 0.10 USDT per TH/s per W/TH reduction, with a floor
of 12 W/TH. These are virtual attributes and program adjustments, not real energy
use or utility bills. Rarity labels describe collection tiers, not a claimed
limited blockchain supply. Cores have no expiry and currently have no resale,
redemption or external transfer mechanism.

Initial daily estimates use:

```
virtual TH/s × (0.36 − 0.003 × virtual W/TH) USDT
```

At the initial prices and attributes, an unchanged Core's 30-day illustration is
81–95.4% of its purchase price. This is not a guaranteed recovery period or an
independent source of revenue. The program can change. All customer-facing
descriptions identify the experience as virtual and estimates as non-guaranteed.

Rewards accrue proportionally from purchase time and settle in the existing
daily reward window. Power/efficiency changes are split into time segments, so
an upgrade cannot retroactively increase earlier earnings. Integer micro-USDT
arithmetic carries fractional remainders forward. Missed settled Core rewards
remain collectible; this differs from legacy balance-tier Earn.

Settled rewards credit the user's available USDT wallet when collected. Existing
automatic withdrawals then pay from the existing working wallet. There is no
separate reward-budget funding step or extra signing wallet. Actual external
withdrawals still depend on the existing wallet liquidity and network resources.
Level 1 and level 2 referrals retain their 10% and 5% reward rates. Settled
referral credits are collected by the referring account.

## Reliability and operation

Purchases, upgrades and collections require idempotency keys and run through the
existing serialized transaction queue. Persisted receipts protect retries across
restarts. Client-side pending commands survive reload without storing passwords.
Core ownership, price, quote revision, upgrade bounds and wallet affordability
are enforced by the server. The old Earn-claim and Spot-to-Earn transfer endpoints
return 410 in Forge mode.

`scripts/forge-readiness.cjs` performs an aggregate-only read of the existing MySQL
state. It prints total balances, feature/signing flags and a combined-balance
checksum, without writing files, exporting accounts or printing secrets. Compare
its output around cutover, allowing for legitimate concurrent activity.

The admin Forge tab reports issued Cores, calculated rewards, collected rewards,
pending reward liabilities, held small deposits and daily settlements. These
account figures remain distinct from on-chain working-wallet balances.

## Validation

```
node --test scripts/verify-forge.cjs scripts/verify-forge-api.cjs
node scripts/verify-forge-ui.cjs
```

Tests use isolated synthetic accounts, not copies of production data. They cover
balance conservation, duplicate/concurrent requests, lost HTTP responses,
restart persistence, time-weighted upgrades, deposit thresholds, ownership and
the real front-end/API flow. The Three.js renderer uses original procedural
geometry, local assets, lazy viewport rendering and reduced-motion support.

Reference research: [GoMining miners](https://docs.gomining.com/en/product/miners),
[power](https://docs.gomining.com/en/product/miners/computing-power),
[efficiency](https://docs.gomining.com/en/product/miners/energy-efficiency).
GoMining describes real computing hardware; Forge makes no equivalent claim.
