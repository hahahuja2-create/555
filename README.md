# TaskMall maintenance notice

This branch restores the original TaskMall maintenance page, translations and
assets until **31 October 2026 at 18:00 Asia/Tbilisi** (`2026-10-31T14:00:00Z`).

It runs only on the retired TaskMall Railway service. It never imports the
financial backend, opens MySQL, or runs a deposit/collection worker. Portgainy
on the `main` branch remains the only application managing the existing ledger.

After the deadline, public pages lead to the working Portgainy platform while
retired financial/operator APIs remain unavailable. `npm test` checks routing,
the exact reopening boundary and preservation of the original notice assets.
