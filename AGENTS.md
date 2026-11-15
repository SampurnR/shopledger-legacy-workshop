# ShopLedger project instructions

## Stack
- CommonJS JavaScript on Node.js; the workshop requires Node.js 22 or newer.
- Express and body-parser serve a plain HTML, CSS, and JavaScript browser UI.
- Persistent storage is a JSON file at `data/db.json`.

## Module map
- `server.js`: Express setup, static UI, API mounting, printable invoice route.
- `public/`: browser UI and API calls.
- `routes/products.js`: catalogue and coupons.
- `routes/orders.js`: order creation, retrieval, filtering, and cancellation.
- `routes/customers.js`: customer accounts and settlements.
- `routes/reports.js`: dashboard, GST reconciliation, pricing preview, admin export.
- `lib/inventory.js`: stock checks, deductions, release, summaries.
- `lib/pricing.js`, `lib/coupons.js`, `lib/tax.js`: checkout totals, coupon rules, GST.
- `lib/orders.js`: order records, listing, cancellation.
- `lib/ledger.js`: Khata balances, credit charges, reversals, settlements.
- `lib/invoice.js`: invoice calculations and printable HTML.
- `lib/reports.js`: dashboard and GST reconciliation calculations.
- `lib/dates.js`: date formatting, filtering keys, fiscal years.
- `lib/store.js`: JSON storage and audit entries.
- `config.js`: application, shop, tax, coupon, and inventory configuration.
- `docs/`: architecture diagram.

## Commands
- `npm install`: install dependencies. The workshop says not to commit package-lock.json.
- `npm start`: start the app; the default URL is http://localhost:3000.
- `node --test`: run Node's built-in test runner. Invoice characterization tests are in `test/invoice-current-behaviour.test.js` and use synthetic in-memory fixtures.
- `npm test`: currently a placeholder that exits with an error; do not report it as passing.

## Required workflow
1. Write characterization tests before changing behavior. Pin current behavior, including bugs; name tests for apparently incorrect behavior "CURRENT BEHAVIOUR".
2. Change only the module or modules required by the selected ticket. Keep the fix minimal; do not fix unrelated defects.
3. Tests must never read or write `data/db.json`. Use synthetic in-memory fixtures. Reproduce app behavior only in a temporary project copy with its own database.
4. Add no dependencies. Use `node:test` and `node:assert/strict` for tests.
5. Show a failing test for the intended behavior before implementing the fix, then run all tests and review the diff.
6. Keep these instructions factual and update the testing notes when tests are added. Ask the user to choose the ticket before ticket-specific work.
