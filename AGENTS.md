# Repository Guidelines

## Stack

ShopLedger uses Node.js, CommonJS JavaScript, Express 4, and body-parser. The browser UI uses plain HTML, CSS, and JavaScript with XMLHttpRequest. Application state is stored in a tracked JSON file; there is no database server.

## Module Map

- `server.js`: Express setup, static files, API mounting, and printable invoice endpoint.
- `routes/`: product/coupon, order, customer/settlement, and reporting/preview endpoints.
- `public/`: browser interface, styles, and client-side request handling.
- `lib/pricing.js`, `lib/tax.js`, `lib/coupons.js`: checkout totals, GST rates, and coupon rules.
- `lib/inventory.js`, `lib/orders.js`: stock operations and order management.
- `lib/ledger.js`, `lib/dates.js`: Khata balances, settlements, and date utilities.
- `lib/invoice.js`, `lib/reports.js`: printable invoices, dashboard summaries, and GST reconciliation.
- `lib/store.js`: synchronous persistence in `data/db.json`.
- `config.js`: port, shop details, GST slabs, coupons, and inventory defaults.
- `docs/architecture.png`: workshop architecture snapshot captured before the invoice fix.

## Commands

- `npm install`: install the declared dependencies.
- `npm start`: start the app at `http://localhost:3000` by default.
- `PORT=3001 npm start`: run on port 3001.
- `node --test`: run Node's built-in test runner.
- `node --test --experimental-test-coverage`: run tests with built-in coverage.

Tests live in `test/` and use `node:test` with in-memory fixtures. `npm test` is a placeholder that exits with an error; use `node --test`. No build or lint scripts are configured.

## Required Rules

1. Write characterization tests before changing behaviour. Name tests documenting suspicious existing behaviour `CURRENT BEHAVIOUR`.
2. Change only the module the ticket is about.
3. Tests must never touch `data/db.json`: do not read or write it. Use independent, in-memory fixtures.
4. Add no dependencies.
