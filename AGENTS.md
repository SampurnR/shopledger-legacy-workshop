# ShopLedger

ShopLedger is an internal point-of-sale app for retail and wholesale billing, inventory, and khata (customer credit).

## Stack

- Node.js with CommonJS, Express 4, and `body-parser` 1.x.
- Plain HTML, CSS, and JavaScript in `public/`. The browser calls the API with `XMLHttpRequest`.
- `lib/store.js` reads and writes `data/db.json` synchronously. The file holds products, orders, customers, settlements, ID counters, and the audit log.

## Module map

- `server.js` serves `public/`, mounts the routers at `/api`, and serves printable invoices at `/orders/:id/invoice`. `config.js` holds the port, shop details, GST rates, and coupon settings.
- `routes/products.js` serves the catalog and active coupons. `lib/inventory.js` handles sellable stock and stock updates.
- `routes/orders.js` handles order creation, history, and cancellation. `lib/orders.js` manages order records, `lib/dates.js` handles dates, and `lib/pricing.js` uses `lib/coupons.js` and `lib/tax.js` to calculate totals.
- `routes/customers.js` lists customers and records settlements. `lib/ledger.js` handles khata balances and credit limits.
- `routes/reports.js` serves dashboard, GST reconciliation, and cart pricing endpoints. `lib/reports.js` builds the reports, and `lib/invoice.js` calculates and renders invoices.

## Commands

- `npm start` runs `node server.js`. The server uses `PORT` or defaults to `3000`.
- `npm test` runs the built-in Node.js test runner against the suites in `test/`. The suites use fixtures in memory.

## Rules

- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never read from, write to, or otherwise touch `data/db.json`.
- Add no dependencies.
