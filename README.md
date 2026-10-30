# TaskMall migration notice

This branch displays a multilingual notice that the platform has moved to
https://portgainy.com, where users can sign in with their existing account.

It runs only on the retired TaskMall Railway service. It never imports the
financial backend, opens MySQL, or runs a deposit/collection worker. Portgainy
on the `main` branch remains the only application managing the existing ledger.

The notice includes a link to Portgainy and preserves valid referral codes in the
link. Retired financial and operator APIs remain unavailable on TaskMall.
`npm test` checks the notice and routing without connecting to a database.
