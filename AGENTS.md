# ShopLedger

## Stack

ShopLedger 0.8.4 is a shop billing, inventory, and customer credit (khata) app.
It uses Node.js with CommonJS modules, Express 4, and body-parser 1.
The browser uses plain HTML, CSS, JavaScript, and XMLHttpRequest; there is no
frontend build step. Persistence is synchronous JSON file I/O to `data/db.json`.
No Node.js version is pinned in `package.json`.

## Module map

- `server.js`: Express entry point, static UI, `/api` router mounting, and printable invoice route.
- `public/index.html`, `public/js/app.js`, `public/css/style.css`: billing, order history, khata, and inventory/GST audit UI.
- `routes/products.js`: catalog and active coupons.
- `routes/orders.js`: order listing, lookup, creation, and cancellation.
- `routes/customers.js`: customer balances and settlements.
- `routes/reports.js`: dashboard, GST reconciliation, pricing preview, and keyed data export.
- `lib/pricing.js`, `lib/coupons.js`, `lib/tax.js`: checkout totals, coupon rules, and tax lookup/splitting.
- `lib/inventory.js`: stock checks, deductions, release logic, and inventory summary.
- `lib/orders.js`: order records, filtering, and cancellation orchestration.
- `lib/ledger.js`: customer credit charges, reversals, and settlements.
- `lib/invoice.js`: separate invoice calculations and printable HTML.
- `lib/reports.js`: dashboard aggregation and invoice/ledger reconciliation.
- `lib/dates.js`: date formatting, filter normalization, and fiscal-year helper.
- `lib/store.js`: database reads/writes, structure defaults, and audit entries.
- `config.js`: shop details, port, admin key, tax, inventory, and coupon settings.
- `data/db.json`: products, orders, customers, settlements, audit log, and ID counters.
- `docs/architecture.png`: architecture and order-flow diagram.

## Commands

Run these from the `shopledger` directory:

- `npm start`: runs `node server.js`; starts the server on `PORT`, defaulting to 3000.
- `node server.js`: starts the same server directly.
- `npm test`: currently prints `Error: no test specified` and exits with status 1.
  It is a placeholder, not a working test suite.

There are no build or lint scripts in `package.json`.

## Rules for changes

- Write characterization tests that capture current behavior before changing behavior.
- Change only the module the ticket is about. Keep accompanying characterization
  tests focused on that module; do not refactor or fix unrelated modules.
- Tests must never touch `data/db.json`: do not read, write, reset, or replace it.
  Use isolated in-memory fixtures or a test-only store substitute.
- Add no dependencies.
