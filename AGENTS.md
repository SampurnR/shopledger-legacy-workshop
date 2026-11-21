# ShopLedger

ShopLedger is a Node.js CommonJS app for retail and wholesale billing, stock, customer credit (Khata), and GST reconciliation. It uses Express 4, body-parser, plain browser JavaScript, and a synchronous JSON file store.

## Module map

- `server.js` serves `public/`, mounts the four API routers, and renders printable invoices at `/orders/:id/invoice`.
- `routes/products.js`, `routes/orders.js`, `routes/customers.js`, and `routes/reports.js` handle catalog and coupons, checkout and cancellation, Khata settlements, and reporting and pricing previews respectively.
- `lib/pricing.js`, `lib/coupons.js`, and `lib/tax.js` calculate checkout figures. `lib/invoice.js` builds the printable invoice and supplies figures to `lib/reports.js`.
- `lib/inventory.js`, `lib/orders.js`, `lib/ledger.js`, and `lib/dates.js` handle stock, order records, customer credit, and dates.
- `config.js` defines shop settings, coupon rules and GST slabs. `lib/store.js` reads and writes `data/db.json`.

## Commands

- Use Node.js 22 or newer for the workshop. Install the existing dependencies with `npm install`. Leave the generated lockfile out of workshop commits.
- Run `npm start` to serve the app at `http://localhost:3000` by default. Use a temporary project copy for reproduction.
- Run `node --test` from the repository root. The legacy `npm test` script is a placeholder.

## Safe fixes

1. Write passing characterization tests before changing behavior. Mark known incorrect results with `CURRENT BEHAVIOUR` until a failing regression test demonstrates the intended result.
2. Change only the production module(s) involved in the selected ticket.
3. Use in-memory fixtures for tests. Tests must never read or write `data/db.json`.
4. Add no dependencies.
