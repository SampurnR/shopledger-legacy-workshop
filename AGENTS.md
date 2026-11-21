# ShopLedger engineering instructions

ShopLedger is a CommonJS Node.js application. Express 4 and body-parser serve a
plain HTML/CSS/JavaScript browser UI and JSON API. The app stores its state in
`data/db.json` through `lib/store.js`.

- `server.js` serves `public/`, mounts the four routers under `/api`, and owns
  the printable order invoice route.
- `routes/products.js`, `orders.js`, `customers.js`, and `reports.js` implement
  catalog, checkout, Khata, and reporting endpoints.
- `lib/pricing.js`, `tax.js`, and `coupons.js` implement checkout money rules
  using `config.js`. `lib/invoice.js` renders invoices and `lib/reports.js`
  compares invoice calculations with saved orders.
- `lib/orders.js`, `inventory.js`, `ledger.js`, and `dates.js` handle order
  lifecycle, stock, Khata balances, and dates.

Run the app with `npm start` (default port 3000). Run tests with `node --test`
on a Node.js version that supports the built-in test runner. Use
`node:test` and `node:assert/strict` with deterministic in-memory fixtures.

Characterize existing behavior before changing business logic. For a bug fix,
capture a failing desired-behavior test against the original code before editing
production code, then rerun the full suite. Preserve working behavior through
focused regression tests. Keep changes narrow and add no dependencies. Never
modify `data/db.json` during tests or run state-mutating tests against it.
Review the diff and verify the tracked data file before handoff.
