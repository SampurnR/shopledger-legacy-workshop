# ShopLedger project instructions

## Stack

- Node.js 22 or newer, CommonJS JavaScript, Express 4, and body-parser.
- Plain HTML, CSS, and browser JavaScript; no frontend build step.
- Synchronous JSON persistence in `data/db.json`.
- Tests use the built-in `node:test` and `node:assert/strict` modules.

## Module map

- `server.js`: Express application, static files, router mounting, HTML invoice route.
- `routes/products.js`: catalog and active coupons.
- `routes/orders.js`: order listing, creation, lookup, and cancellation.
- `routes/customers.js`: khata accounts and settlements.
- `routes/reports.js`: dashboard, GST reconciliation, pricing preview, and export.
- `lib/inventory.js`: sellable stock, stock checks, deductions, restoration, summary.
- `lib/orders.js`: order records, cancellation orchestration, search, date filters.
- `lib/pricing.js`, `lib/tax.js`, `lib/coupons.js`: checkout totals and GST.
- `lib/ledger.js`: customer credit and settlement calculations.
- `lib/invoice.js`, `lib/reports.js`: printable invoices and reporting.
- `lib/dates.js`: date formatting and comparison helpers.
- `lib/store.js`: JSON persistence and audit records.
- `config.js`: shop settings, tax slabs, coupons, inventory settings, export key.
- `public/`: four-tab browser UI. `test/`: in-memory characterization and regression tests.
- `docs/`: architecture, checkpoint records, review, and submission evidence.

## Commands

- Install existing dependencies: `npm install` (`npm.cmd install` in restricted PowerShell).
- Start: `npm start` (`npm.cmd start` on Windows), normally port 3000.
- Run all tests: `node --test`.
- Run a particular file: `node --test test/inventory.characterization.test.js`.
- `npm test` remains the original placeholder; use `node --test` directly.

## Rules

1. Write characterization tests before changing behavior. Name tests that capture
   a known bug `CURRENT BEHAVIOUR` before the fix; update them explicitly afterward.
2. Change only the application module(s) involved in the selected ticket. Ticket 2
   changes belong in `lib/inventory.js`; exercise its callers without rewriting them.
3. Tests must never read or write `data/db.json`. Build fresh in-memory fixtures.
   Reproduce UI/API bugs only in a temporary project copy with its own database.
4. Add no dependencies.
5. Make the smallest fix and review the diff and test results before opening a PR.
6. Do not commit generated `package-lock.json`, `node_modules/`, or modified seed data.
7. Use `fix/<short-name>` for the branch. Never force-push or merge the submission PR.
