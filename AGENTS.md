# ShopLedger workshop instructions

## Stack and scope

ShopLedger v0.8.4 is a shop billing, inventory, customer credit (khata), and GST invoice application.
It uses Node.js with CommonJS modules, Express 4, and body-parser 1.
The frontend is plain HTML, CSS, and JavaScript using XMLHttpRequest.
There is no frontend build step or external database. Persistence is synchronous JSON file I/O.

## Module map

- `server.js`: Express setup, static frontend, API routers, printable invoice route.
- `public/index.html`, `public/css/style.css`, `public/js/app.js`: UI, styles, cart state, API calls, and table rendering.
- `routes/products.js`: product catalog/search/categories and active coupons.
- `routes/orders.js`: order listing, retrieval, creation, and cancellation.
- `routes/customers.js`: customer balances and settlement requests.
- `routes/reports.js`: dashboard, GST reconciliation, pricing preview, and admin export.
- `lib/pricing.js`: checkout totals and proportional discount allocation.
- `lib/tax.js`: GST rate resolution and CGST/SGST splitting.
- `lib/coupons.js`: coupon normalization, validation, thresholds, and discount caps.
- `lib/inventory.js`: sellable stock, checks, deductions, releases, and stock summaries.
- `lib/orders.js`: order records, cancellation, search, date filtering, and sorting.
- `lib/ledger.js`: customer credit limits, debits, reversals, and settlements.
- `lib/invoice.js`: invoice figures using shared checkout pricing, plus printable HTML.
- `lib/reports.js`: dashboard aggregation and invoice-versus-ledger reconciliation.
- `lib/dates.js`: date formatting, date-filter keys, and fiscal years.
- `lib/store.js`: JSON read/write and audit entries.
- `config.js`: port, shop details, tax slabs, coupons, inventory defaults, and admin key.
- `data/db.json`: tracked products, orders, customers, settlements, audit log, and ID counters.
- `docs/architecture.svg`: architecture diagram from CP2.

## Commands

Run commands from the project root.

- `npm install --no-package-lock`: install the existing declared dependencies without generating a lockfile.
- `npm start`: run `node server.js`; default URL is `http://localhost:3000`. `PORT` can override the port.
- `node --test`: run Node's built-in test runner for in-memory characterization and invoice regression tests in `test/`.
- `npm test`: currently a placeholder that prints an error and exits with status 1; it is not a working test suite.

## Workshop rules

1. Write characterization tests before changing behavior. Use `node:test` to pin current behavior, including bugs; name tests covering known incorrect behavior with `CURRENT BEHAVIOUR`. At CP3, do not fix application behavior.
2. Change only the module or modules relevant to the selected ticket. Make the smallest fix. Add or update the associated tests; keep unrelated source changes out of the diff.
3. Tests must use in-memory fixtures and must never read or write the tracked `data/db.json`. For app reproduction, use a temporary project copy and its disposable data file. Leave the original project's data unchanged.
4. Add no dependencies. Use Node's built-in test runner and assertions.

For CP4, demonstrate a failing test for the expected behavior before fixing it. Identify any characterization tests updated, run the full test suite, and review the diff.
Do not commit generated `node_modules/` or `package-lock.json`.
