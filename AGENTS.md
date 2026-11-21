# ShopLedger

## Stack

- Node.js with CommonJS, Express 4, and body-parser 1 for JSON requests.
- Plain HTML, CSS, and browser JavaScript served from `public/`.
- `lib/store.js` reads and writes the JSON datastore at `data/db.json`.

## Module map

- `routes/customers.js` lists Khata customers and records settlements.
- `routes/orders.js` creates, lists, retrieves, and cancels orders.
- `routes/products.js` lists products and active coupons.
- `routes/reports.js` serves dashboard and GST reports, pricing previews, and admin export.
- `lib/coupons.js` normalizes coupon codes, checks eligibility, and calculates discounts.
- `lib/dates.js` formats dates, normalizes filter keys, and derives fiscal years.
- `lib/inventory.js` looks up products, checks sellable quantities, and updates stock or reservations.
- `lib/invoice.js` recalculates figures from saved order items and renders printable HTML.
- `lib/ledger.js` calculates Khata balances, applies or reverses order charges, and records settlements.
- `lib/orders.js` adds, finds, filters, and cancels saved orders.
- `lib/pricing.js` computes checkout totals by allocating discounts across lines and applying GST.
- `lib/reports.js` computes dashboard metrics and compares invoice figures with saved order totals and tax.
- `lib/store.js` reads and writes the JSON datastore and appends audit entries.
- `lib/tax.js` resolves item GST rates and splits tax into CGST and SGST.

## Commands

- Start the app with `node server.js` or `npm start`. The default port is 3000, configurable via `PORT`.
- Run tests with `node --test`. The current `npm test` script is a failing placeholder.

## Rules

1. Write characterization tests before changing behavior.
2. Change only the modules the ticket is about.
3. Use in-memory data in tests. Tests must never read or write `data/db.json`.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket

The printable invoice total and GST breakdown do not match what the customer was billed.

Allowed files are `lib/invoice.js` and, only if truly needed, `lib/tax.js`.
