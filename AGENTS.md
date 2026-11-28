# ShopLedger

## Stack
- Node.js with CommonJS JavaScript; Express 4 serves the API and `public/` static files.
- Browser UI uses HTML, CSS, and JavaScript; persistent application data is stored in `data/db.json`.

## Module map
- `routes/customers.js` — list customers and settlements; record Khata settlements.
- `routes/orders.js` — list, fetch, create, and cancel orders.
- `routes/products.js` — list/filter products and list active coupons.
- `routes/reports.js` — dashboard, GST reconciliation, pricing preview, and keyed data export.
- `lib/coupons.js` — normalize, find, validate, calculate, and list coupons.
- `lib/dates.js` — format today's date, normalize date keys, and calculate fiscal years.
- `lib/inventory.js` — find products, check/reserve/release stock, and summarize inventory.
- `lib/invoice.js` — compute invoice figures and render printable invoice HTML.
- `lib/ledger.js` — customer balances, Khata charges/reversals, and settlements.
- `lib/orders.js` — add, find, cancel, and filter orders.
- `lib/pricing.js` — calculate subtotals, coupon discounts, GST, and order totals.
- `lib/reports.js` — build dashboard summaries and GST reconciliation results.
- `lib/store.js` — synchronously read/write `data/db.json` and append audit entries.
- `lib/tax.js` — resolve item GST rates and split GST into CGST/SGST.

## Commands
- Start the app: `npm start` (runs `node server.js`).
- Run tests: `node --test`.

## Rules
1. Write characterization tests before changing behaviour.
2. Change only the module(s) the ticket is about.
3. Tests never read or write `data/db.json`; use in-memory data.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket
- Invoice total and GST breakdown do not match what the customer was billed.
- Allowed files: `lib/invoice.js`; `lib/tax.js` only if truly needed.
