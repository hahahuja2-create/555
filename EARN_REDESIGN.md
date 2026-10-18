# TaskMall Earn and synthetic Spot positions

Tasks and VIP purchases are replaced by Earn. Historical activity is retained. Earning balance uses the compatible lockedBalance storage field; Spot balance uses withdrawBalance. No financial column or customer account is deleted.

## Account conversion

On activation (TASKMALL_EARN_ENABLED=1), the server converts the current stored accounts in the existing single-writer transaction. An active paid VIP with purchase evidence restores its current plan principal once to Earning balance. Spot, reserved balances, payment records and historical purchases remain unchanged. Version markers prevent repeat restoration after a restart. Read-only preflight found 10 accounts, one active purchased principal of 30 USDT, and a proposed Earn balance of 30.43 USDT for that account. Private account snapshots remain under ignored artifacts/earn-migration. Production never imports a local snapshot over live state.

## Earn

- The common daily reset remains 00:00 UTC / 04:00 Asia/Tbilisi. Registration becomes eligible at the next reset. Existing daily claim dates and historical task rewards prevent a second reward in the same UTC day.
- Claim pays 10% of current Earn principal to Spot, without reducing principal. Missed days do not accumulate.
- Referral levels receive 10% and 5% of the claimed reward, as additional operator-funded credits.
- Claims debit the separate Earn reward pool atomically with all credits. UUID receipts make retries idempotent. No insufficiently funded claim is booked.
- The operator must fund the reward pool. This is independent of synthetic trading: removing the crypto inventory requirement does not mint an Earn reward fund. TRON_EARN_FUND_ADDRESS must be a dedicated operator address. The authenticated funding endpoint verifies solidified official USDT transfer logs and deduplicates them.

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
