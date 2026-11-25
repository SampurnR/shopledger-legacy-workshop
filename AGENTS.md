# ShopLedger

## Stack
- Node.js CommonJS application using Express (`^4.17.1`) and body-parser (`^1.19.0`).
- Browser UI uses HTML, CSS, and JavaScript in `public/`.
- `lib/store.js` persists application data in `data/db.json`.

## Module map
- `routes/customers.js` — list customers/settlements and record a Khata settlement.
- `routes/orders.js` — list, fetch, create, and cancel orders.
- `routes/products.js` — list/search products and active coupons.
- `routes/reports.js` — dashboard, GST reconciliation, pricing preview, and admin export.
- `lib/coupons.js` — normalize, look up, validate, and calculate coupon discounts.
- `lib/dates.js` — format today's date, normalize date keys, and calculate fiscal year.
- `lib/inventory.js` — find products, check/reserve/release stock, and summarize inventory.
- `lib/invoice.js` — compute invoice figures and render printable invoice HTML.
- `lib/ledger.js` — customer lookup/listing, Khata billing/reversal, and settlements.
- `lib/orders.js` — add, fetch, cancel, and filter/sort orders.
- `lib/pricing.js` — subtotal, discount, and order total calculations.
- `lib/reports.js` — dashboard summary and GST reconciliation calculations.
- `lib/store.js` — read/write `data/db.json` and append audit entries.
- `lib/tax.js` — resolve tax rates and split CGST/SGST.

## Commands
- Start the app: `npm start` (runs `node server.js`).
- Run tests: `node --test` (Node's built-in test runner; no test files were found during repository inspection).

## Rules
1. Write characterization tests before changing behaviour.
2. Change only the module(s) the ticket is about.
3. Tests never read or write `data/db.json`; use in-memory data.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket
Order history sorting and date filtering are broken, and Khata settlements corrupt customer balances. Allowed files: `lib/orders.js` (list only), `lib/dates.js`, `lib/ledger.js`, `routes/customers.js`.
