# ShopLedger

## Stack

- Node.js with CommonJS, Express 4, and `body-parser` for JSON requests.
- Static HTML, CSS, and browser JavaScript in `public/`.
- Synchronous JSON persistence in `data/db.json`.

## Module map

- `routes/customers.js` lists Khata accounts and records settlements.
- `routes/orders.js` lists, retrieves, places, and cancels orders.
- `routes/products.js` lists and filters products and lists active coupons.
- `routes/reports.js` serves dashboard and GST reconciliation reports, cart pricing previews, and database export.
- `lib/coupons.js` normalizes and validates coupon codes, calculates discounts, and lists active coupons.
- `lib/dates.js` formats today's date, normalizes date strings, and derives fiscal years.
- `lib/inventory.js` looks up products, calculates sellable stock, checks availability, updates stock or reservations, and summarizes inventory.
- `lib/invoice.js` recalculates invoice figures and renders printable HTML.
- `lib/ledger.js` lists Khata balances, applies and reverses order charges, and records settlements.
- `lib/orders.js` adds, retrieves, filters, and cancels order records.
- `lib/pricing.js` allocates coupon discounts across checkout lines and calculates GST and totals.
- `lib/reports.js` builds dashboard summaries and compares stored order figures with recalculated invoice figures.
- `lib/store.js` reads and writes the JSON database and maintains its audit log.
- `lib/tax.js` resolves item GST rates and splits GST into CGST and SGST.

## Commands

- Start the app with `node server.js` or `npm start`.
- Run tests with `node --test`. The repo currently has no test files, and `npm test` is a placeholder that exits with an error.

## Rules

1. Write characterization tests before changing behavior.
2. Change only the modules the ticket is about.
3. Tests must use in-memory data and must never read or write `data/db.json`.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket

- The printable invoice total and GST breakdown differ from what the customer was billed. Checkout stores its calculated totals on the order, and the printable invoice recalculates them independently.
- Allowed implementation file is `lib/invoice.js`. Change `lib/tax.js` only if truly needed.
