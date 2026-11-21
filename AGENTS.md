# ShopLedger contributor notes

## Stack
- Node.js, CommonJS, Express 4, and body-parser; browser UI is static HTML/CSS/JS.
- Application data is stored in `data/db.json` through `lib/store.js`.

## Module map
- `routes/customers.js` — lists customers and recent settlements; records Khata settlements.
- `routes/orders.js` — lists, creates, retrieves, and cancels orders.
- `routes/products.js` — lists products and active coupons.
- `routes/reports.js` — dashboard, GST reconciliation, pricing preview, and admin export endpoints.
- `lib/coupons.js` — coupon normalization, lookup, validation, and discount calculation.
- `lib/dates.js` — current date string, date-key normalization, and fiscal-year label.
- `lib/inventory.js` — product lookup, sellable stock, order stock checks, reserve/release, and summary.
- `lib/invoice.js` — invoice figures and printable invoice HTML.
- `lib/ledger.js` — customer ledger summaries, Khata charges/reversals, and settlements.
- `lib/orders.js` — order add/get/cancel and filtered order listing.
- `lib/pricing.js` — subtotal, discount, and order GST totals.
- `lib/reports.js` — dashboard summary and GST reconciliation calculations.
- `lib/store.js` — reads/writes `data/db.json` and appends audit entries.
- `lib/tax.js` — item GST rate lookup and CGST/SGST split.

## Commands
- Start the app: `node server.js` (listens on the configured port, default 3000).
- Run tests: `node --test` (Node's built-in test runner; no test files are currently present).

## Rules
1. Write characterization tests before changing behaviour.
2. Change only the module(s) the ticket is about.
3. Tests never read or write `data/db.json`; use in-memory data.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket
- Order history sorting and date filtering are broken, and Khata settlements corrupt customer balances.
- Allowed files: `lib/orders.js` (`list` only), `lib/dates.js`, `lib/ledger.js`, `routes/customers.js`.
