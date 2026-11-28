# Repository guide

## Stack

- Node.js application using Express 4 and `body-parser`.
- Browser UI is static HTML, CSS, and vanilla JavaScript in `public/`.
- Application data is stored as JSON in `data/db.json` through `lib/store.js`.
- Tests use Node's built-in test runner; no test framework dependency is installed.

## Module map

- `server.js` configures Express, serves `public/`, mounts API routers, and serves printable invoices.
- `config.js` contains server, shop, tax, inventory, and coupon configuration.
- `routes/products.js` exposes product and active coupon lists.
- `routes/orders.js` handles order listing, creation, retrieval, and cancellation.
- `routes/customers.js` exposes customer balances and records settlements.
- `routes/reports.js` serves dashboard and GST reconciliation data, pricing previews, and admin export.
- `lib/store.js` reads and writes the JSON data file and maintains audit entries.
- `lib/pricing.js`, `lib/tax.js`, and `lib/coupons.js` calculate checkout totals, GST, and discounts.
- `lib/inventory.js`, `lib/orders.js`, and `lib/ledger.js` handle stock, order records, and customer credit.
- `lib/invoice.js` renders printable invoices; `lib/dates.js` handles date formatting and fiscal-year labels; `lib/reports.js` builds dashboard and GST reconciliation results.
- `data/db.json` contains products, customers, orders, settlements, audit log entries, and ID counters.
- `test/` contains Node built-in tests.

## Commands

- `npm start` starts the server.
- `npm test` runs tests with `node --test`.

## Change rules

- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never modify or write `data/db.json`.
- Add no dependencies.
