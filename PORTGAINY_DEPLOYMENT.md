# Portgainy production

- Repository: `hahahuja2-create/555`, branch `main`.
- Railway project: `b03a64c1-101d-40da-89b1-7783dfd7d498`.
- Production environment: `6f89e6c9-8684-416b-86ad-b7dd959929d3`.
- Application service: `f27cc1d0-5c08-439b-94be-3e7c20231cb7` (`555`).
- URL: https://555-production-d903.up.railway.app
- Existing MySQL service: `25cede4c-7afa-4ee5-9062-7164177b354b`.

The database is retained in place. The application uses the existing scoped MySQL
identity, original signed public TRON wallet, treasury, operator credential and
payment rules. No accounts, balances, deposit addresses, withdrawal requests or
referral campaign dates are imported or reset. Existing passwords remain valid.
The private wallet and collection journal stay on the original protected Windows
signer; they are never uploaded to GitHub or the web host.

Financial state is owned by one application process. During the transition, stop
the TaskMall application writer before allowing Portgainy to acquire the existing
MySQL writer lock. Keep MySQL running. Future application replacements also require
the old application deployment to stop; do not run both services against this
ledger or bypass the lock. The new process waits up to 300 seconds for the lock.
If rollback is necessary, stop Portgainy before restarting the previous application.

Railway variables are transferred privately through the CLI. `PUBLIC_ORIGIN` is
the Portgainy HTTPS URL; `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT=8080`,
`TASKMALL_EARN_ENABLED=1`, `TASKMALL_SPOT_ENABLED=1`,
`TASKMALL_MAINTENANCE_ENABLED=0`, `TASKMALL_SQLITE=0`,
`TASKMALL_TEST_WALLET=0` and `TRON_AUTO_WALLET=0`.
The MySQL, public-wallet, TronGrid and operator secret variables retain their
existing values. Legacy `TASKMALL_` names, session cookies, wallet proof strings
and DPAPI entropy are intentionally retained to preserve compatibility.

Before and after deployment, compare read-only hashes of authentication records,
financial balances and history, deposit mappings, pending withdrawals, migrations,
wallet registration and campaign metadata. Do not copy the database to perform
this comparison. Production HTTP checks must preserve origin protection, secure
session cookies and unauthenticated/operator access restrictions.
