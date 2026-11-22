# ShopLedger

## Stack

- Node.js with CommonJS, Express 4, and body-parser for JSON requests.
- Plain HTML, CSS, and browser JavaScript in `public/`, served by `server.js`.
- `lib/store.js` uses synchronous file I/O to persist state in `data/db.json`.

## Module map

- `routes/customers.js` — Lists Khata customers and records settlements.
- `routes/orders.js` — Lists, fetches, places, and cancels orders.
- `routes/products.js` — Lists products and active coupons.
- `routes/reports.js` — Serves the dashboard, GST reconciliation, cart pricing preview, and database export.
- `lib/coupons.js` — Normalizes and validates coupon codes and calculates discounts.
- `lib/dates.js` — Formats dates, normalizes date strings, and derives fiscal years.
- `lib/inventory.js` — Looks up products, calculates sellable stock, checks and updates inventory, and summarizes stock.
- `lib/invoice.js` — Recalculates invoice figures from order data and renders printable HTML.
- `lib/ledger.js` — Looks up customers, checks credit limits, adjusts Khata balances, and records settlements.
- `lib/orders.js` — Creates, retrieves, filters, and cancels order records.
- `lib/pricing.js` — Calculates checkout subtotals, prorated discounts, line GST, and totals.
- `lib/reports.js` — Summarizes dashboard metrics and compares stored order figures with invoice calculations.
- `lib/store.js` — Reads and writes JSON state and maintains the audit log.
- `lib/tax.js` — Resolves item GST rates and splits GST into CGST and SGST.

## Commands

- Start the app with `npm start` or `node server.js`.
- Run tests with Node's built-in runner using `node --test`. The `npm test` script is a failing placeholder.

## Rules

1. Write characterization tests before changing behavior.
2. Change only the modules the ticket is about.
3. Tests use in-memory data and never read or write `data/db.json`.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket

The printable invoice total and GST breakdown do not match what the customer was billed. Checkout applies HSN rates after prorating discounts. The printable invoice recalculates GST before discounts and falls back to the default rate when a saved line has no GST rate.

Allowed source files for the fix are `lib/invoice.js` and, only if truly needed, `lib/tax.js`.
