# ShopLedger

## Stack

- Node.js with CommonJS modules, Express 4, and `body-parser` for JSON requests.
- `server.js` serves the HTML, CSS, and vanilla JavaScript in `public/` and mounts the routers under `/api`.
- `config.js` holds shop and app settings. `data/db.json` is the app's JSON data store.

## Module map

- `routes/customers.js` lists Khata accounts and records settlements.
- `routes/orders.js` lists, retrieves, places, and cancels orders.
- `routes/products.js` serves the product catalog and active coupons.
- `routes/reports.js` serves dashboard and GST reconciliation reports, pricing previews, and admin export.
- `lib/coupons.js` normalizes and validates coupon codes and calculates discounts.
- `lib/dates.js` provides date keys and fiscal-year helpers.
- `lib/inventory.js` looks up products, checks sellable stock, adjusts stock and reservations, and summarizes inventory.
- `lib/invoice.js` recalculates invoice figures and renders printable HTML.
- `lib/ledger.js` looks up Khata accounts and handles charges, reversals, and settlements.
- `lib/orders.js` adds, retrieves, filters, and cancels order records.
- `lib/pricing.js` allocates checkout discounts and computes line GST and order totals.
- `lib/reports.js` builds dashboard and GST reconciliation summaries.
- `lib/store.js` reads and writes the JSON store and maintains its audit log.
- `lib/tax.js` resolves item GST rates and splits tax into CGST and SGST.

## Commands

- Start the app with `node server.js` or `npm start`. The port defaults to 3000 and can be set with `PORT`.
- Run tests with `node --test`. The repo currently has no test files, and `npm test` is a failing placeholder.

## Rules

1. Write characterization tests before changing behaviour.
2. Change only the module(s) the ticket is about.
3. Tests must use in-memory data and must never read or write `data/db.json`.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket

The printable invoice total and GST breakdown do not match what the customer was billed. Allowed files are `lib/invoice.js` and, only if truly needed, `lib/tax.js`.
