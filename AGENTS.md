# ShopLedger

ShopLedger is a retail and wholesale billing desk with stock tracking, printable GST invoices, and a khata ledger for customer credit and repayments.

## Stack

- Node.js with CommonJS modules, Express 4, and `body-parser` for JSON requests. The workshop uses Node.js 22 or newer.
- Plain HTML, CSS, and JavaScript served from `public/`.
- The app reads and writes its records in `data/db.json`, a tracked file.

## Module map

- `server.js` serves the browser UI, mounts the API routers, and serves printable invoices.
- `routes/products.js` serves the catalog and coupons. `routes/orders.js` handles order creation, lookup, listing, and cancellation. `routes/customers.js` lists customer accounts and records settlements. `routes/reports.js` serves dashboard reports, GST reconciliation, cart previews, and data export.
- `lib/pricing.js`, `lib/tax.js`, and `lib/coupons.js` calculate checkout totals, GST, and discounts.
- `lib/orders.js`, `lib/inventory.js`, `lib/ledger.js`, and `lib/dates.js` handle order records, stock, khata balances, and dates.
- `lib/invoice.js` calculates and renders printable invoices. `lib/reports.js` builds reports and compares invoice figures with stored order totals.
- `lib/store.js` handles JSON persistence and audit entries. `config.js` holds shop details, GST rates, coupons, and inventory defaults.

## Commands

- `npm install` installs the existing dependencies for local setup. Leave the generated `package-lock.json` out of the workshop commit.
- `npm start` runs the app on port 3000 by default. Placing or cancelling orders and recording settlements can update the tracked data file. Use a temporary project copy for workshop reproduction.
- `node --test` runs the workshop test suite once tests are added. The current `npm test` script is a failing placeholder.

## Workshop rules

1. Write passing characterization tests before changing behavior. Use `node:test` and mark tests that capture known wrong behavior with `CURRENT BEHAVIOUR`.
2. Keep production changes limited to the module or modules covered by the chosen ticket.
3. Use in-memory fixtures. Tests must never read from or write to `data/db.json`.
4. Add no dependencies.
