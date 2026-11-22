# ShopLedger agent notes

## Stack
- Node.js CommonJS app using Express 4 (`express` `^4.17.1`) and `body-parser` (`^1.19.0`).
- `server.js` serves static files from `public/`, mounts API routers at `/api`, and serves printable invoice HTML at `/orders/:id/invoice`.
- Application data is held in `data/db.json` via synchronous file reads and writes in `lib/store.js`.

## Module map
- `routes/customers.js` - lists customer/settlement data and records Khata settlements.
- `routes/orders.js` - lists, fetches, creates, and cancels orders.
- `routes/products.js` - lists products and active coupons.
- `routes/reports.js` - serves dashboard, GST reconciliation, pricing preview, and admin export.
- `lib/coupons.js` - normalizes, validates, calculates, and lists coupons.
- `lib/dates.js` - formats today's date, normalizes date keys, and derives fiscal year.
- `lib/inventory.js` - finds products, checks/reserves/releases stock, and summarizes inventory.
- `lib/invoice.js` - computes invoice figures and renders printable invoice HTML.
- `lib/ledger.js` - lists customers, charges/reverses Khata orders, and records settlements.
- `lib/orders.js` - adds, finds, cancels, and filters orders.
- `lib/pricing.js` - computes order subtotal, coupon discount, GST, and totals.
- `lib/reports.js` - computes dashboard summary and invoice-versus-ledger GST reconciliation.
- `lib/store.js` - reads/writes JSON data and appends audit entries.
- `lib/tax.js` - resolves GST rates/slabs and splits tax into CGST and SGST.

## Commands
- Start the app: `node server.js`.
- Run tests: `node --test` (Node's built-in test runner; no test files were found during inspection).
- `package.json` currently defines `npm start` as `node server.js`; its `npm test` script is a placeholder that exits with an error.

## Rules
1. Write characterization tests before changing behaviour.
2. Change only the module(s) the ticket is about.
3. Tests never read or write `data/db.json`; use in-memory data.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket
- Invoice total and GST breakdown do not match what the customer was billed.
- Allowed files: `lib/invoice.js` (`lib/tax.js` only if truly needed).