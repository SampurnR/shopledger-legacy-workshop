# Repository Guidelines

## Stack

- Node.js with CommonJS modules.
- Express 4 serves `public/` and mounts JSON API routers.
- Application records are stored in `data/db.json` through `lib/store.js`.

## Module map

### `routes/`

- `routes/customers.js` — list customers and record Khata settlements.
- `routes/orders.js` — list, fetch, place, and cancel orders.
- `routes/products.js` — list products and active coupons.
- `routes/reports.js` — dashboard, GST reconciliation, pricing preview, and admin export endpoints.

### `lib/`

- `lib/coupons.js` — normalize, validate, calculate, and list coupons.
- `lib/dates.js` — current date, date-key normalization, and fiscal year.
- `lib/inventory.js` — product lookup, sellable stock, stock checks/reservation/release, and summary.
- `lib/invoice.js` — invoice figures and printable invoice HTML.
- `lib/ledger.js` — customer lookup, Khata charges/reversals, and settlements.
- `lib/orders.js` — add, fetch, cancel, and filter orders.
- `lib/pricing.js` — subtotal, discount, and order total calculations.
- `lib/reports.js` — dashboard summary and GST reconciliation.
- `lib/store.js` — read/write JSON data and append audit entries.
- `lib/tax.js` — resolve GST rates/slabs and split CGST/SGST.

## Commands

- Start the app: `npm start` (runs `node server.js`).
- Run tests: `node --test` (Node's built-in test runner; no test files are currently present).

## Rules

1. Write characterization tests before changing behaviour.
2. Change only the module(s) the ticket is about.
3. Tests never read or write `data/db.json`; use in-memory data.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket

Invoice total and GST breakdown do not match what the customer was billed. Allowed files: `lib/invoice.js` (`lib/tax.js` only if truly needed).
