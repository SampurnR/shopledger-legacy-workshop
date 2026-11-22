# ShopLedger

## Stack

- Node.js with CommonJS, Express 4, and body-parser. `server.js` serves the static UI and mounts the API under `/api`.
- Plain HTML, CSS, and browser JavaScript in `public/`. Application data lives in `data/db.json`.

## Module map

- `routes/customers.js` — Lists Khata customers and recent settlements and records payments.
- `routes/orders.js` — Lists, retrieves, places, and cancels orders.
- `routes/products.js` — Lists products and active coupons.
- `routes/reports.js` — Serves dashboard and GST reconciliation data, previews cart pricing, and exports the database.
- `lib/coupons.js` — Normalizes coupon codes, validates eligibility, and calculates discounts.
- `lib/dates.js` — Formats today's date, normalizes date strings, and derives fiscal years.
- `lib/inventory.js` — Looks up products, calculates sellable stock, checks availability, deducts stock, releases reservations, and summarizes inventory.
- `lib/invoice.js` — Recalculates invoice figures and renders printable HTML.
- `lib/ledger.js` — Lists customers and handles Khata charges, reversals, and settlements.
- `lib/orders.js` — Adds, retrieves, lists, and cancels order records.
- `lib/pricing.js` — Calculates checkout subtotals, apportions coupon discounts, and computes GST and totals.
- `lib/reports.js` — Builds dashboard totals and compares stored order figures with invoice figures.
- `lib/store.js` — Reads and writes the JSON database and appends audit entries.
- `lib/tax.js` — Resolves GST rates and splits tax into CGST and SGST.

## Commands

- Start the app from the repo root with `node server.js`. The port defaults to 3000 and can be set with `PORT`.
- Run tests from the repo root with `node --test`. The `npm test` script is a placeholder that exits with failure.

## Rules

1. Write characterization tests before changing behaviour.
2. Change only the modules the ticket is about.
3. Tests must use in-memory data and must never read or write `data/db.json`.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket

- The last sellable unit cannot be sold because `inventory.check()` rejects quantities equal to sellable stock.
- Cancelling an order never restores physical stock. `orders.cancel()` calls `inventory.release()`, which looks up `productId` and reduces `reserved`. New order lines store `id`, and checkout deducts `stock`.
- Allowed implementation files are `lib/inventory.js` and `lib/orders.js` (only `cancel()`).
