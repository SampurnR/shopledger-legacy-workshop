# ShopLedger

## Stack
- Node.js CommonJS application using Express 4 and body-parser.
- Browser UI is static HTML, CSS, and JavaScript in public/.
- Application data is stored in data/db.json through lib/store.js.

## Module map
- routes/customers.js — lists customers and settlements; records Khata settlements.
- routes/orders.js — lists, reads, creates, and cancels orders; coordinates pricing, inventory, Khata, audit, and storage.
- routes/products.js — lists/searches products and lists active coupons.
- routes/reports.js — serves dashboard/GST reports, pricing preview, and keyed data export.
- lib/coupons.js — normalizes, lists, validates, and calculates configured coupons.
- lib/dates.js — formats today, normalizes date keys, and derives fiscal years.
- lib/inventory.js — finds products, checks sellable stock, adjusts stock/reservations, and summarizes inventory.
- lib/invoice.js — computes invoice figures and renders printable invoice HTML.
- lib/ledger.js — reads customer balances, charges/reverses Khata orders, and records settlements.
- lib/orders.js — adds, finds, cancels, and lists orders; cancellation calls inventory release and conditionally reverses Khata.
- lib/pricing.js — calculates subtotals, discounts, GST totals, and line breakdowns.
- lib/reports.js — calculates dashboard summaries and GST reconciliation.
- lib/store.js — synchronously reads/writes data/db.json and appends audit entries.
- lib/tax.js — resolves GST rates and splits tax into CGST/SGST.

## Commands
- Start the app: `node server.js`
- Run tests: `node --test`
- No `*.test.js` or `*.spec.js` files are present currently.

## Rules
1. Write characterization tests before changing behaviour.
2. Change only the module(s) the ticket is about.
3. Tests never read or write data/db.json; use in-memory data.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket
- Problem: the last sellable stock unit cannot be sold, and cancelling an order does not restore stock.
- Allowed files: lib/inventory.js and lib/orders.js (cancel only).
