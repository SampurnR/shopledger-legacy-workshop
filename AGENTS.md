# ShopLedger

## Stack

- Node.js CommonJS application using Express 4.17.1 and body-parser 1.19.0.
- `server.js` serves `public/`, mounts `/api` routers, and renders the invoice route.
- Runtime persistence is JSON through `lib/store.js` and `data/db.json`.
- Note: this checkout is currently split; `server.js` and `config.js` are here, while `routes/`, `lib/`, `public/`, and `data/` are in the sibling `shopledger-legacy-code` directory.

## Module map

- `routes/products.js`: lists products and active coupons.
- `routes/orders.js`: lists, reads, creates, and cancels orders.
- `routes/customers.js`: lists customers and records Khata settlements.
- `routes/reports.js`: serves dashboard/GST reports, pricing preview, and admin export.
- `lib/coupons.js`: normalizes, validates, lists, and calculates coupon discounts.
- `lib/dates.js`: formats and normalizes application dates.
- `lib/inventory.js`: finds products, checks stock, reserves stock, releases stock, and summarizes inventory.
- `lib/invoice.js`: calculates invoice figures and renders printable HTML invoices.
- `lib/ledger.js`: lists customers, charges/reverses Khata orders, and records settlements.
- `lib/orders.js`: adds, finds, lists, and cancels orders.
- `lib/pricing.js`: calculates subtotals, discounts, GST, CGST/SGST, and checkout totals.
- `lib/reports.js`: calculates dashboard and GST reconciliation report data.
- `lib/store.js`: reads/writes `data/db.json` and appends audit entries.
- `lib/tax.js`: resolves GST rates from `gstRate` or HSN slabs and splits CGST/SGST.

## Commands

- Start the app: `npm start`
- Run tests: `node --test`
- The current `package.json` test script is a placeholder and does not run tests.

## Rules

1. Write characterization tests before changing behaviour.
2. Change only the module(s) the ticket is about.
3. Tests never read or write `data/db.json`; use in-memory data.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket

Invoice total and GST breakdown do not match what the customer was billed.

Allowed files: `lib/invoice.js` (`lib/tax.js` only if truly needed).
