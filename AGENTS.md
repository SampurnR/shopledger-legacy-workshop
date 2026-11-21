# ShopLedger

## Stack
- Node.js, CommonJS, Express 4 (`express` ^4.17.1), and `body-parser` ^1.19.0.
- Browser UI is static HTML, CSS, and JavaScript in `public/`.
- Application data is synchronously read from and written to `data/db.json` by `lib/store.js`.

## Module map
- `routes/customers.js` — customer/settlement API using the ledger.
- `routes/orders.js` — order listing, creation, and cancellation API.
- `routes/products.js` — product and active coupon lookup API.
- `routes/reports.js` — dashboard, GST reconciliation, pricing preview, and admin export API.
- `lib/coupons.js` — coupon normalization, lookup, validation, and discount calculation.
- `lib/dates.js` — date formatting, date-key normalization, and fiscal-year helper.
- `lib/inventory.js` — stock lookup, sellable stock, checks, reserve/release, and summary.
- `lib/invoice.js` — invoice figure calculation and printable HTML rendering.
- `lib/ledger.js` — Khata customer balances, order debits/reversals, and settlements.
- `lib/orders.js` — add, get, cancel, and list order operations.
- `lib/pricing.js` — subtotal, coupon discount delegation, and checkout totals/GST calculation.
- `lib/reports.js` — dashboard summary and invoice/order GST reconciliation.
- `lib/store.js` — JSON database read/write and bounded audit log append.
- `lib/tax.js` — item GST rate/slab lookup and CGST/SGST split.

## Commands
- Start the app: `npm start` (runs `node server.js`; default port is 3000).
- Run tests: `node --test` (Node's built-in test runner; `package.json` currently has no test script beyond a placeholder that exits with failure).

## Rules
1. Write characterization tests before changing behaviour.
2. Change only the module(s) the ticket is about.
3. Tests never read or write `data/db.json`; they use in-memory data.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket
- Invoice total and GST breakdown do not match what the customer was billed.
- Allowed files: `lib/invoice.js` (`lib/tax.js` only if truly needed).
