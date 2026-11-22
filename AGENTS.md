# ShopLedger contributor notes

## Stack
- Node.js, CommonJS, Express 4, and body-parser; browser UI is static HTML, CSS, and JavaScript.
- Persistent application data is stored in `data/db.json` through `lib/store.js`.

## Module map
- `routes/customers.js` — customer list and Khata settlement endpoints.
- `routes/orders.js` — order listing, lookup, creation, and cancellation endpoints.
- `routes/products.js` — product listing and active coupon endpoint.
- `routes/reports.js` — dashboard, GST reconciliation, pricing preview, and admin export endpoints.
- `lib/coupons.js` — coupon lookup, normalization, validation, discounts, and active coupon list.
- `lib/dates.js` — today's date, date-key normalization, and fiscal year.
- `lib/inventory.js` — product lookup, sellable stock checks, stock changes, and inventory summary.
- `lib/invoice.js` — invoice figure calculation and printable HTML rendering.
- `lib/ledger.js` — customer balances, Khata charges/reversals, and settlements.
- `lib/orders.js` — add, get, cancel, and filter/sort orders.
- `lib/pricing.js` — subtotal, coupon discount, line tax, and order totals.
- `lib/reports.js` — dashboard summary and GST reconciliation calculations.
- `lib/store.js` — read/write the JSON store and append audit entries.
- `lib/tax.js` — resolve GST rates and split tax into CGST/SGST.

## Commands
- Start the app: `node server.js` (or `npm start`).
- Run tests: `node --test`.

## Rules
1. Write characterization tests before changing behaviour.
2. Change only the module(s) the ticket is about.
3. Tests never read or write `data/db.json`; use in-memory data.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket
- Invoice total and GST breakdown do not match what the customer was billed.
- Allowed files: `lib/invoice.js` (`lib/tax.js` only if truly needed).
