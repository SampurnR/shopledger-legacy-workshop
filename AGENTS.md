# ShopLedger project notes

## What this app is

ShopLedger is a single-process Express application for a small shop's point of sale, order register, customer Khata ledger, inventory, invoices, and reports. The browser UI is served from `public/`. The API routes are mounted under `/api` by `server.js`. There is no database server or ORM: `lib/store.js` synchronously reads and writes `data/db.json`.

## Main request paths

- `routes/products.js`: `GET /api/products`, `GET /api/coupons`.
- `routes/orders.js`: list/get/create/cancel orders at `/api/orders...`. Creating an order resolves product IDs from the current JSON store, checks stock, computes coupon and GST totals, optionally charges a registered customer's Khata account, reduces product stock, appends an audit entry, writes the JSON file, and returns the created order.
- `routes/customers.js`: `GET /api/customers`, `POST /api/customers/:id/settle`.
- `routes/reports.js`: dashboard and GST reconciliation, pricing preview, and `GET /api/admin/export`.
- `GET /orders/:id/invoice` is registered directly in `server.js` and rendered by `lib/invoice.js`.
- `config.js` supplies the port, shop details, HSN tax slabs, inventory defaults, coupons, and the key checked by `/api/admin/export`.

## Library responsibilities

- `coupons.js`: coupon lookup, normalization, validation, and discounts.
- `dates.js`: Indian date formatting and date-key helpers.
- `inventory.js`: product lookup, sellable-stock checks, stock reservation/release, and inventory summary.
- `invoice.js`: invoice totals and HTML rendering.
- `ledger.js`: customer balances, Khata debits/reversals, and settlements.
- `orders.js`: order creation, lookup, cancellation, and filtering.
- `pricing.js`: subtotals, coupon discounts, per-line GST, and order totals.
- `reports.js`: dashboard totals and comparison of stored order totals with invoice calculations.
- `store.js`: synchronous JSON persistence and capped audit-log append.
- `tax.js`: HSN tax-rate selection and CGST/SGST split.

## Running and tests

- `npm start` starts the server (default port 3000, overridable with `PORT`).
- `npm test` runs the dependency-free Node.js built-in test suite (`node --test`). No install is needed for these library tests; starting the HTTP server still requires the declared Express and body-parser dependencies.
- Tests use in-memory fixtures and do not write to `data/db.json`.

## Current behavior to preserve or revisit deliberately

These are observations of the current implementation, not recommendations:

- `inventory.check()` rejects an order when requested quantity is equal to sellable stock (`qty >= sellable`).
- `inventory.reserve()` subtracts order quantity from physical `stock`. `orders.cancel()` passes the stored order items to `inventory.release()`, which looks for `item.productId`; newly created order items store `id`. As written, cancellation does not restore stock for those items.
- `orders.list()` and its date filters compare normalized `DD/MM/YYYY` strings lexicographically; this is not chronological ordering across month or year boundaries.
- `reports.getDashboardSummary()` excludes cancelled orders from revenue and tax totals, but includes pending orders.
- `/api/admin/export` checks `config.adminKey`; other routes do not implement authentication. `config.js` mentions `/api/admin/reset`, but no reset route is currently registered.

The characterization tests under `test/` record selected current behavior, including the stock boundary and cancellation release behavior. If behavior is intentionally corrected, update the relevant test and this section together.
