# TaskMall Earn and synthetic Spot positions

Tasks and VIP purchases are replaced by Earn. Historical activity is retained. Earning balance uses the compatible lockedBalance storage field; Spot balance uses withdrawBalance. No financial column or customer account is deleted.

## Account conversion

On activation (TASKMALL_EARN_ENABLED=1), the server converts the current stored accounts in the existing single-writer transaction. An active paid VIP with purchase evidence restores its current plan principal once to Earning balance. Spot, reserved balances, payment records and historical purchases remain unchanged. Version markers prevent repeat restoration after a restart. Read-only preflight found 10 accounts, one active purchased principal of 30 USDT, and a proposed Earn balance of 30.43 USDT for that account. Private account snapshots remain under ignored artifacts/earn-migration. Production never imports a local snapshot over live state.

## Earn

- The common daily reset remains 00:00 UTC / 04:00 Asia/Tbilisi. Registration becomes eligible at the next reset. Existing daily claim dates and historical task rewards prevent a second reward in the same UTC day.
- Claim pays 10% of current Earn principal to Spot, without reducing principal. Missed days do not accumulate.
- Referral levels receive 10% and 5% of the claimed reward, as additional account credits, without reducing the claimant’s reward.
- Claims and both referral credits commit atomically to Spot without a prepaid reward-pool requirement. UUID receipts make retries idempotent. Earn principal remains unchanged.
- The operator sends actual USDT after a withdrawal request, using the existing manual payout workflow. A Claim is a ledger accrual, not a completed external payment. Accounting schema v2 tracks totalAccruedUnits; prior funding records and totalPaidUnits are retained unchanged for history. The obsolete funding endpoint returns EARN_FUNDING_NOT_REQUIRED.

## Personal referral promotion

The `active-referrals-15-v1` campaign starts once, when the updated Earn server first launches. Existing accounts receive ten days from that timestamp; later accounts receive ten days from their registration timestamp. Restarts do not extend either window.

Ten distinct direct referrals unlock a permanent 15% daily Earn rate when each referral reaches 50 USDT in cumulative confirmed deposits before the owner's deadline. Existing qualifying referrals count immediately. Historical threshold timestamps also qualify an owner who returns after the deadline. A referral reaching 50 USDT at or after the deadline cannot unlock a late upgrade. Internal transfers, rewards, imported balances and VIP principal restoration do not qualify as deposits.

The initial counters are backfilled from the verified deposit ledger; subsequent confirmed receipts update the counters in the same financial transaction as the deposit credit. Claim still runs once per UTC day, preserves principal and uses six-decimal integer arithmetic. First- and second-level commissions remain 10% and 5% of the actual claimed reward. Earlier idempotent Claim receipts are not recalculated.

The account stores the announcement receipt on the server, so concurrent sessions, another device and later logins cannot display it again. The announcement and referral progress card support all ten interface languages and display the account's own deadline.

## Synthetic trading

Binance is a public price source only. TaskMall does not send exchange orders. Buyers receive price-linked internal positions, not on-chain coins or crypto withdrawal rights; the trade dialog and Company page explain this.

- TASKMALL_SPOT_ENABLED=1 enables positions when Earn accounting is enabled.
- Purchases debit existing Spot USDT; sales credit Spot according to the accepted quote. There is no coin inventory or buyback cash gate. Short sales and leverage are not supported.
- The signed netCashFlowUnits counterparty ledger records buy/sell cash flows, including obligations from user profits. It is bookkeeping, not a claim that physical USDT was transferred or reserved.
- Quotes expire after 15 seconds. Stale prices or moves greater than 0.5% require a new quote. Confirmations are owner-bound and idempotent after restarts.
- Six-decimal USDT and eight-decimal positions use integer arithmetic. Default trading fee is zero. Purchase cost is allocated proportionally when positions close; current prices update unrealized P&L.
- Crypto inventory schema v1 upgrades automatically only if empty; nonempty legacy custody records are preserved and block automatic model conversion.

## Payments and local review

Production deposits continue using the existing verified public TRON wallet, unique per-user addresses, solidified USDT receipts, MySQL transactions and replay protection. Withdrawal authorization, the 10 USDT minimum and 10% withdrawal fee remain unchanged. No signer or private recovery material is added to the website.

The local review server has isolated account data and never accepts real deposits. Its Deposit and Withdrawal buttons open the live protected taskmall.app payment page with a wallet intent. Production serves its own QR/address directly. This prevents funds being credited only to a local account copy.

Run npm run preview:design and open http://localhost:4173; sign in using an existing copied account. Stop the owned server before running scripts/prepare-earn-preview.cjs to rebuild the copy. Real live account data must never be overwritten from this directory.

## Assets and credentials

81 genuine crypto logo files are hosted locally. Source URLs are recorded in public/assets/coins/manifest.json and attribution is adjacent. The original TaskMall hexagonal T mark is used consistently as the brand mark and favicon.

Supplied Binance credentials are protected outside Git with Windows DPAPI. Public prices do not require these credentials. No API keys or customer snapshots are shipped to the browser or committed.

## Validation

Run npm run check, npm run test:spot, npm run test:earn, npm run test:assets, npm run test:api, npm run test:payments, npm run test:outgoing, npm run test:admin and npm run test:ui. The UI check uses an isolated temporary account, real public prices, responsive screenshots, genuine images, synthetic buy/sell, exact receipts, a deposit navigation link and a claim countdown. It never sends real payments or creates production test accounts.
