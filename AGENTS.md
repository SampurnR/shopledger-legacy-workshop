# ShopLedger repository guide

## Stack

- Node.js, CommonJS JavaScript, Express 4, and `body-parser`; see `package.json`.
- `server.js` serves the static browser UI in `public/`, mounts four routers at `/api`, and serves printable invoices at `/orders/:id/invoice`.
- `lib/store.js` synchronously reads and rewrites `data/db.json`, which contains products, customers, orders, settlements, counters, and audit records. Treat this sample data as production-like; do not edit it without explicit approval.
- `config.js` contains the port, shop information, GST slabs, inventory defaults, and coupon rules.

## Module map

- `routes/products.js` — product catalog with sellable stock and GST rate; active coupons.
- `routes/orders.js` — list, fetch, create, and cancel orders.
- `routes/customers.js` — customer balances and Khata settlements.
- `routes/reports.js` — dashboard, GST reconciliation, cart pricing preview, and admin export.
- `lib/coupons.js` — normalize, validate, calculate, and list coupons.
- `lib/dates.js` — today's date, date-key normalization, and fiscal year.
- `lib/inventory.js` — product lookup, sellable stock, checks, deductions, releases, and summary.
- `lib/invoice.js` — compute printable invoice figures and render invoice HTML.
- `lib/ledger.js` — customer lookup, balances, Khata charges, reversals, and settlements.
- `lib/orders.js` — add, fetch, cancel, filter, and sort orders.
- `lib/pricing.js` — checkout subtotal, coupon discount, line tax, and totals.
- `lib/reports.js` — dashboard summary and invoice-versus-ledger reconciliation.
- `lib/store.js` — JSON file read/write and audit entries.
- `lib/tax.js` — resolve GST rates and split CGST/SGST.

## Commands

- Start the app: `npm start` (runs `node server.js`; port defaults to 3000).
- Run tests: `node --test`. No test files are currently committed; `npm test` is a placeholder that exits with an error.

## Rules

1. Write characterization tests that reproduce the observed behavior before changing it.
2. Change only the module or modules the ticket is about. Preserve unrelated API behavior.
3. Tests must never read or write `data/db.json`; use in-memory data. Do not invoke the store's fixed-path read/write methods in tests.
4. Add no dependencies.
5. Make the smallest fix that works, and run meaningful regression tests afterward.

## Current ticket

Invoice total and GST breakdown do not match what the customer was billed. Checkout in `routes/orders.js` stores totals from `lib/pricing.js`, which uses `lib/coupons.js` and `lib/tax.js` for discounts and HSN GST. The printable route in `server.js` calls `lib/invoice.js`, which independently computes figures from the saved order. `lib/reports.js` compares the two totals and tax amounts.

Allowed implementation files: `lib/invoice.js`; `lib/tax.js` only if truly needed. Reproduce the mismatch with in-memory order data before changing behavior. Do not implement this ticket while updating this guide.
