# Scheduled platform maintenance

`config/platform-maintenance.json` closes public pages and customer APIs until
31 October 2026 at 18:00 (Asia/Tbilisi), stored as `2026-10-31T14:00:00.000Z`.
The server automatically resumes normal routing at that instant, without a redeploy.
Open maintenance pages check the server every 15 seconds and reload when it reopens.

`public/maintenance.html`, `.css`, and `.js` contain the page and all ten supported
translations. The existing `taskmall_language` browser preference selects the language;
changing the selector saves the same preference. The displayed date never converts to
the visitor's timezone and does not name a country or timezone.

Public pages and customer APIs return 503 with `Retry-After` and `Cache-Control: no-store`.
Health checks, authenticated operator routes, and background deposit/settlement monitoring
continue. Maintenance does not change customer balances, campaign deadlines, or stored sessions.

The optional server variable `TASKMALL_MAINTENANCE_ENABLED=0` disables the closure early;
`1` enables the configured window. Without it, the JSON configuration applies, except
in isolated `NODE_ENV=test` fixtures. Normal application fixtures explicitly disable
maintenance when they exercise development or production mode.

Run `npm run test:maintenance` to verify routing, the reopening boundary, translations,
saved language selection, mobile layout, and automatic page reload. The live-server UI
case skips itself after this one-time maintenance window has ended.
