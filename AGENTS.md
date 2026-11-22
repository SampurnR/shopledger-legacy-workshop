# ShopLedger

## Stack

- Node.js with CommonJS modules, Express and body-parser.
- Plain HTML, CSS and browser JavaScript in `public/`.
- Synchronous JSON file persistence in `data/db.json` through `lib/store.js`.
- `server.js` mounts API routers under `/api` and serves printable HTML invoices.
- `config.js` holds shop details, tax slabs, coupons, inventory settings and the admin key.

## Module map

- `routes/customers.js` lists customer accounts and records Khata settlements.
- `routes/orders.js` lists, fetches, creates and cancels orders.
- `routes/products.js` lists products with sellable stock and GST rates, and active coupons.
- `routes/reports.js` serves dashboard, GST reconciliation, pricing preview and admin export endpoints.
- `lib/coupons.js` normalizes, validates and lists coupons, and calculates discounts from configuration.
- `lib/dates.js` formats today's date, normalizes date strings and derives fiscal years.
- `lib/inventory.js` finds products, checks sellable stock, deducts stock, releases reserved quantities and summarizes inventory.
- `lib/invoice.js` independently calculates invoice figures and renders printable HTML invoices.
- `lib/ledger.js` lists customer balances, charges and reverses Khata debits, and records settlements.
- `lib/orders.js` adds, fetches, filters and cancels orders, calling inventory release and Khata reversal on cancellation.
- `lib/pricing.js` computes subtotals, coupon discounts and post-discount line GST totals.
- `lib/reports.js` aggregates dashboard figures and compares stored orders against invoice calculations.
- `lib/store.js` reads and rewrites the JSON database, applies structure defaults and caps the audit log at 100 entries.
- `lib/tax.js` resolves explicit or HSN-based GST rates and splits tax into CGST and SGST.

## Commands

- Start the app with `node server.js` (the package start script uses this command).
- Run tests with `node --test`.
- The current package test script prints "Error: no test specified" and exits with status 1.

## Rules

1. Write characterization tests before changing behaviour.
2. Change only the module(s) the ticket is about.
3. Tests never read or write `data/db.json`, they use in-memory data.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket

Invoice total and GST breakdown do not match what the customer was billed.
Allowed files are `lib/invoice.js`, with `lib/tax.js` allowed only if truly needed.
