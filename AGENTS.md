# ShopLedger workshop

CommonJS JavaScript on Node.js (workshop: Node 22+), Express 4 and body-parser.
The frontend is plain HTML/CSS/JavaScript using XMLHttpRequest.

## Commands and entry points

- Install existing dependencies: `npm install`.
- Run: `npm start` (`server.js`, default http://localhost:3000; `PORT` overrides).
- Test: `node --test` (tests under `test/`). The package's `npm test` is a placeholder that exits with an error.
- Never stage generated `package-lock.json` or `node_modules/`.

## Module map

- `server.js`: Express setup, static `public/`, four `/api` routers, printable invoice endpoint.
- `routes/`: products/coupons, orders/cancellation, customers/settlements, reports/preview/export.
- `lib/inventory.js`: sellable stock, checks, physical deductions and cancellation restoration.
- `lib/orders.js`: order records, cancellation orchestration, listing/filtering.
- `lib/ledger.js`: Khata accounts, billing, reversals, settlements.
- `lib/pricing.js`, `tax.js`, `coupons.js`: cart totals, HSN GST, discounts.
- `lib/invoice.js`, `reports.js`, `dates.js`: invoice rendering/calculation, reporting, date helpers.
- `lib/store.js`: synchronous JSON persistence and audit log.
- `config.js`: port, shop, tax, inventory, coupon and export settings.
- `data/db.json`: products, orders, customers, settlements, audit log and ID counters.

## Mandatory rules

1. Write characterization tests before changing existing behavior.
2. Change only modules relevant to the selected ticket (#2).
3. Tests must never read, write, or mutate the original `data/db.json`.
4. Never introduce dependencies for this workshop.

Use hand-built in-memory fixtures for unit tests. HTTP tests must replace the store
module before loading `server.js`, supplying cloned in-memory datasets and blocking
real filesystem persistence. Running-app mutation checks must use an isolated copy
of the application and dataset; the store path is fixed relative to `lib/store.js`.
Ticket #2 boundaries: `inventory.check`, `reserve`, `release`, `orders.cancel`,
and their HTTP orchestration in `routes/orders.js`. Preserve existing quantity
normalization and cancellation eligibility policy. Do not change invoice, tax,
Khata, sorting, or date-filter logic. Never commit database changes or evidence.
