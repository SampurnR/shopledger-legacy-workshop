# ShopLedger project instructions

## Current stack and layout

- Node.js, CommonJS, Express, and body-parser.
- Plain HTML, CSS, and browser JavaScript in `public/`.
- `server.js` serves the UI, mounts the API routers, and renders invoice pages.
- `routes/` contains products, orders, customers, and reports routers.
- `lib/pricing.js`, `lib/coupons.js`, and `lib/tax.js` calculate checkout figures.
- `lib/invoice.js` separately calculates and renders invoices.
- Other `lib/` modules handle inventory, orders, Khata ledger, reports, dates, and JSON storage.
- `config.js` defines shop details, tax slabs, coupons, and inventory defaults.
- `data/db.json` is the persistent application database.
- `docs/architecture.svg` maps the current architecture.

## Commands

- `npm install`: install the declared application dependencies.
- `npm start`: start the application on port 3000 by default (`PORT` overrides it).
- `node --test`: run tests using Node's built-in test runner.
- `npm test` is currently a placeholder that exits with an error; use `node --test`.

## Workshop rules

- Write characterization tests before changing behaviour. Name tests that record known incorrect behaviour `CURRENT BEHAVIOUR`.
- Change only the module the selected ticket concerns. Ticket 1 concerns the invoice engine; reuse existing pricing rules rather than duplicating them.
- Tests must use in-memory fixtures and must never read or write `data/db.json`. Reproduce app mutations in a temporary project copy.
- Add no dependencies.
- Make the smallest fix and review the diff and test results before opening a pull request.
- Do not commit generated `package-lock.json`, temporary copies, or unrelated files.

## Ticket 1 checkpoint sequence

- CP3 records existing behaviour, including bugs, with passing characterization tests. Do not fix production code at this checkpoint.
- CP4 demonstrates a failing test for the correct behaviour before making the fix, updates the affected old-behaviour tests, and runs all tests and a review.
