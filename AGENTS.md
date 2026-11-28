# ShopLedger

## Stack
- Node.js with CommonJS modules; package version 0.8.4.
- Declared dependencies: Express ^4.17.1 and body-parser ^1.19.0.
- Browser UI uses static HTML, CSS, and JavaScript in public/.
- lib/store.js synchronously reads and writes data/db.json; no database server.

## Module map
- server.js: Express setup, static UI, /api routers, printable invoice endpoint, listener.
- config.js: Port, shop details, GST slabs, inventory settings, coupons, and admin key.
- routes/customers.js: List customers and settlements; record Khata settlements.
- routes/orders.js: List, retrieve, place, and cancel orders; persist mutations and audits.
- routes/products.js: List and filter products; list active coupons.
- routes/reports.js: Dashboard, GST reconciliation, pricing preview, and keyed data export.
- lib/coupons.js: Normalize, validate, list, and calculate coupon discounts.
- lib/dates.js: Format today's date, normalize date strings, and derive fiscal years.
- lib/inventory.js: Find products, check sellable stock, deduct stock, release reservations, summarize.
- lib/invoice.js: Use checkout pricing to compute invoice figures; render printable HTML and mismatch notices.
- lib/ledger.js: Customer balances, Khata charges and reversals, and settlements.
- lib/orders.js: Add, get, cancel, and filter orders in the supplied database object.
- lib/pricing.js: Subtotals, coupon allocation, post-discount line GST, and checkout totals.
- lib/reports.js: Dashboard summaries and stored-order versus invoice reconciliation.
- lib/store.js: JSON persistence, structure defaults, and capped audit history.
- lib/tax.js: Resolve explicit/HSN/default GST rates and split CGST/SGST.

## Commands
- From the repo root, start with `node server.js` (dependencies must already be available).
- `npm start` maps to the same command; default port is 3000, overridden by PORT.
- Run characterization and invoice regression tests with `node --test` (test/invoice.test.js).
- The package.json test script is a failing placeholder, not a test runner.

## Rules
1. Write characterization tests before changing behaviour.
2. Change only the module(s) the ticket is about.
3. Tests never read or write data/db.json; use in-memory data.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket
- Invoice total and GST breakdown do not match what the customer was billed.
- Allowed files: lib/invoice.js; lib/tax.js only if truly needed.
