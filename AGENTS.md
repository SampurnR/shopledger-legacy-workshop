# ShopLedger

## Stack
- Node.js with CommonJS, Express and body-parser; plain HTML, CSS and browser JavaScript.
- `server.js` serves `public/` and the API; `config.js` holds shop, tax and coupon settings.
- `lib/store.js` reads and writes the JSON data in `data/db.json`.

## Module map
- `routes/products.js` — product and active coupon endpoints.
- `routes/orders.js` — order listing, creation, lookup and cancellation.
- `routes/customers.js` — customer listing and khata settlements.
- `routes/reports.js` — dashboard, GST reconciliation, pricing preview and export.
- `lib/coupons.js` — coupon normalization, validation and discounts.
- `lib/dates.js` — date formatting, normalization and fiscal year helpers.
- `lib/inventory.js` — stock lookup, checks, deduction, release and summaries.
- `lib/invoice.js` — invoice figure calculation and printable HTML rendering.
- `lib/ledger.js` — customer credit balances, charges, reversals and settlements.
- `lib/orders.js` — order creation, retrieval, cancellation and filtering.
- `lib/pricing.js` — subtotal, discounts and checkout totals.
- `lib/reports.js` — dashboard summaries and invoice reconciliation.
- `lib/store.js` — JSON persistence and audit entries.
- `lib/tax.js` — GST rate resolution and CGST/SGST splitting.

## Commands
- Start the app: `npm start` (default port 3000; override with `PORT`).
- Run Node's test runner: `node --test`. The `npm test` script is a failing placeholder.

## Rules
1. Write characterization tests before changing behaviour.
2. Change only the module or modules the ticket is about.
3. Tests must never read or write `data/db.json`; use in-memory data.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket
Invoice total and GST breakdown do not match what the customer was billed.
Allowed implementation files: `lib/invoice.js`; `lib/tax.js` only if truly needed.
