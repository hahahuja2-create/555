# Portgainy

Portgainy uses the existing Railway MySQL database and the existing account, Earn, referral, trading and payment backend. No customer data is copied or imported.

## Production

Deploy this repository to the Portgainy service in the existing Railway project. Configure the protected MySQL, TRON and operator variables from the existing service; set NODE_ENV=production, PUBLIC_ORIGIN to the Portgainy HTTPS domain, TASKMALL_EARN_ENABLED=1, TASKMALL_SPOT_ENABLED=1 and TASKMALL_MAINTENANCE_ENABLED=0. The TASKMALL_ variable and cookie names remain for compatibility with the existing ledger and signer.

Run exactly one database writer. Stop the previous application deployment before starting a replacement. MySQL is retained in place; never clone or reinitialize it. Existing passwords, balances, deposit addresses, pending withdrawals, referral deadlines and transaction history remain authoritative.

Wallet private keys and protected recovery remain on the Windows signer. Only the signed public wallet configuration is deployed. Never commit .env, data, SQL dumps, tokens, private wallet files or backups.

## Verification

```powershell
npm ci
npm run check
npm run test:earn
npm run test:api
npm run test:payments
npm run test:outgoing
npm run test:ui
```

Automated fixtures are isolated and do not use production accounts or copy the production database. Production checks must not credit or spend money merely to test connectivity.
