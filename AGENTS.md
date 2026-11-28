# ShopLedger

ShopLedger is an internal point-of-sale, inventory, and customer credit (khata) app for wholesale and retail sales.

## Stack

- Node.js with CommonJS, Express 4, and `body-parser` 1.x.
- Plain HTML, CSS, and browser JavaScript served by Express.
- Synchronous JSON storage in `data/db.json`.

## Module map

- `server.js` serves `public/`, mounts the routers under `/api`, and serves printable order invoices.
- `routes/products.js` serves the catalog and active coupons. `routes/orders.js` handles order lookup, placement, and cancellation. `routes/customers.js` serves customer accounts and records settlements. `routes/reports.js` serves the dashboard, GST reconciliation, pricing preview, and admin export.
- `lib/orders.js` manages order records. `lib/inventory.js` handles stock. `lib/ledger.js` handles customer credit and settlements.
- `lib/pricing.js`, `lib/coupons.js`, and `lib/tax.js` calculate checkout totals. `lib/invoice.js` computes and renders printable invoices. `lib/reports.js` builds dashboard and reconciliation figures.
- `lib/store.js` reads and writes `data/db.json` and maintains the audit log. `lib/dates.js` handles date formatting and normalization. `config.js` holds the port, shop details, tax rates, inventory settings, coupon definitions, and export key.

## Commands

- `npm start` runs `node server.js` on `PORT` or port `3000` by default.
- `npm test` currently prints `Error: no test specified` and exits with status `1`.

## Rules

- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never read or write `data/db.json`. Use in-memory data or temporary fixtures.
- Add no dependencies.
