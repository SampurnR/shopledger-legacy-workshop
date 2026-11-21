# ShopLedger

## Stack
- Node.js with CommonJS JavaScript.
- Express 4 serves the browser files and API; `body-parser` parses JSON request bodies.
- Persistent application data is stored in `data/db.json` through `lib/store.js`.
- Browser UI is plain HTML, CSS, and JavaScript under `public/`.

## Module map
- `routes/customers.js` — customer listing and Khata settlement routes.
- `routes/orders.js` — order listing, creation, lookup, and cancellation routes.
- `routes/products.js` — product listing and active coupon routes.
- `routes/reports.js` — dashboard, GST reconciliation, pricing preview, and admin export routes.
- `lib/coupons.js` — coupon normalization, validation, discount calculation, and active coupon listing.
- `lib/dates.js` — current date, date-key normalization, and fiscal year helpers.
- `lib/inventory.js` — product lookup, sellable stock, stock checks/updates, and inventory summary.
- `lib/invoice.js` — invoice figure calculation and printable HTML rendering.
- `lib/ledger.js` — customer lookup/listing, Khata charges/reversals, and settlement records.
- `lib/orders.js` — order add/get/cancel/list operations.
- `lib/pricing.js` — subtotal, discount, tax, and order total calculations.
- `lib/reports.js` — dashboard summary and invoice-to-order GST reconciliation.
- `lib/store.js` — reads and writes `data/db.json` and appends audit records.
- `lib/tax.js` — resolves GST rates and splits GST into CGST and SGST.

## Commands
- Start the app: `npm start` (runs `node server.js`).
- Run tests: `node --test test/run.js`.

## Rules
1. Write characterization tests before changing behaviour.
2. Change only the module(s) the ticket is about.
3. Tests never read or write `data/db.json`; use in-memory data.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket
- Invoice total and GST breakdown do not match what the customer was billed.
- Allowed files: `lib/invoice.js` (`lib/tax.js` only if truly needed).
