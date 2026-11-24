# ShopLedger

## Stack
- Node.js, CommonJS JavaScript; package version 0.8.4.
- Declared dependencies: Express `^4.17.1`, body-parser `^1.19.0`.
- Plain HTML/CSS/browser JavaScript in `public/`; JSON persistence in `data/db.json`.

## Module map
- `server.js`: Express setup, static UI, `/api` router mounts, printable invoice endpoint.
- `config.js`: Port, shop details, admin key, GST slabs, inventory settings and coupons.
- `routes/customers.js`: Lists customer balances/settlements and records Khata settlements.
- `routes/orders.js`: Lists/gets orders, validates checkout, charges Khata, deducts stock and cancels orders.
- `routes/products.js`: Lists/filter products with sellable stock and GST rates; lists active coupons.
- `routes/reports.js`: Dashboard, GST reconciliation, pricing preview and key-protected database export.
- `lib/coupons.js`: Coupon normalization, lookup, validation, capped discounts and active coupon listing.
- `lib/dates.js`: Local DD/MM/YYYY dates, date-string normalization and fiscal-year labels.
- `lib/inventory.js`: Product lookup, sellable stock, stock checks/deductions, reservation release and summaries.
- `lib/invoice.js`: Independently recomputes invoice figures and renders printable HTML with total mismatch warnings.
- `lib/ledger.js`: Customer lookup/balances, Khata charges/reversals and settlement recording.
- `lib/orders.js`: In-memory order creation, lookup, filtering, sorting and cancellation.
- `lib/pricing.js`: Checkout subtotals, proportional coupon allocation, post-discount line GST and totals.
- `lib/reports.js`: Dashboard aggregates and stored-order versus recomputed-invoice reconciliation.
- `lib/store.js`: Synchronous JSON file reads/writes, default structure and capped audit log.
- `lib/tax.js`: Explicit-rate/exact-HSN GST resolution, 18% fallback and CGST/SGST splitting.
- `public/`: Browser POS, order register, Khata and inventory/GST audit interface.
- `data/db.json`: Products, customers, orders, settlements, audit log and next IDs.

## Commands
- Start: `node server.js` (or `npm start`); port is `PORT` or 3000.
- Run tests directly: `node --test`.
- No test files currently exist; `npm test` is a failing placeholder, not the test runner.

## Rules
1. Write characterization tests before changing behaviour.
2. Change only the module(s) the ticket is about.
3. Tests never read or write `data/db.json`; use in-memory data.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket
- Invoice total and GST breakdown do not match what the customer was billed.
- Allowed files: `lib/invoice.js`; `lib/tax.js` only if truly needed.
- Checkout uses `pricing.computeTotals()`; invoice uses separate `computeInvoiceFigures()` logic.
