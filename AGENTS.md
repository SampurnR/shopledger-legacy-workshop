# ShopLedger

## Stack

Node.js, CommonJS, Express 4, and body-parser. `server.js` serves the HTML, CSS, and JavaScript in `public/`, mounts the routers under `/api`, and serves printable invoices. `config.js` holds shop, tax, inventory, and coupon settings. Application data lives in `data/db.json`.

## Module map

- `routes/customers.js` lists Khata customers and recent settlements, and records payments.
- `routes/orders.js` handles order placement, history, lookup, and cancellation.
- `routes/products.js` lists products and active coupons.
- `routes/reports.js` serves dashboard and GST reports, cart pricing previews, and the admin export.
- `lib/coupons.js` normalizes coupon codes, checks eligibility, and calculates discounts.
- `lib/dates.js` formats local dates, normalizes date inputs, builds chronological sort keys, and derives fiscal years.
- `lib/inventory.js` looks up products, checks sellable stock, updates inventory, and summarizes stock.
- `lib/invoice.js` recalculates invoice figures and renders printable HTML.
- `lib/ledger.js` calculates customer balances, applies and reverses Khata charges, and records settlements.
- `lib/orders.js` creates, retrieves, lists, and cancels orders.
- `lib/pricing.js` apportions discounts across cart lines and computes GST and order totals.
- `lib/reports.js` summarizes sales, inventory, and receivables and reconciles invoices with saved orders.
- `lib/store.js` reads and writes the JSON database and maintains the audit log.
- `lib/tax.js` resolves item GST rates and splits tax into CGST and SGST.

## Commands

- Start the app with `npm start` (runs `node server.js`).
- Run tests with `node --test`. The `npm test` script is a placeholder that exits with status 1.

## Rules

1. Write characterization tests before changing behaviour.
2. Change only the modules covered by the ticket.
3. Use in-memory data for tests. Tests must never read or write `data/db.json`.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket

Cannot sell the last sellable unit in stock because the stock check rejects quantities equal to sellable stock. Cancelling an order never restores physical stock because cancellation calls `inventory.release()`, which only reduces reservations.

Allowed files are `lib/inventory.js` and `lib/orders.js` (only `cancel()`).
