# AGENTS.md

## Stack
- Runtime: Node.js (>= 22)
- Web framework: Express 4 (`express`, `body-parser`)
- Storage: Flat JSON file (`data/db.json`) via `lib/store.js`
- Tests: Built-in Node.js test runner (`node:test`, `node:assert/strict`)

## Module Map
- `server.js` — Express app setup, static `public/` hosting, API router mounting, and `/orders/:id/invoice` HTML route
- `config.js` — Port, shop metadata, HSN-to-GST slab table, inventory defaults, and coupon definitions
- `routes/products.js` — Product catalog endpoints
- `routes/orders.js` — Order listing, creation (`POST /api/orders`), and cancellation (`POST /api/orders/:id/cancel`)
- `routes/customers.js` — Khata customer listing and settlement recording
- `routes/reports.js` — Dashboard summary and GST reconciliation endpoints
- `lib/store.js` — Synchronous JSON read/write and audit log helpers for `data/db.json`
- `lib/inventory.js` — Sellable stock calculation, stock checks, reservation, release, and summary
- `lib/pricing.js` — Subtotal, coupon discount apportionment, and HSN-slab GST calculation
- `lib/coupons.js` — Coupon normalization, validation, and discount calculation
- `lib/tax.js` — Item GST rate lookup (`gstRate` / HSN slab / default) and CGST/SGST split
- `lib/invoice.js` — Invoice figure computation and printable HTML rendering
- `lib/orders.js` — Order creation, lookup, cancellation, and filtered/sorted listing
- `lib/ledger.js` — Khata customer balances, credit charges, debit reversals, and settlements
- `lib/dates.js` — `DD/MM/YYYY` formatting, date key normalization, and fiscal year calculation
- `lib/reports.js` — Dashboard metrics and invoice-vs-ledger GST reconciliation
- `test/` — `node:test` suites using in-memory fixtures

## Commands
- Install dependencies: `npm install`
- Start server: `npm start` (serves on `http://localhost:3000`)
- Run tests: `node --test`

## Rules
- Write characterization tests before changing behaviour.
- Change only the module(s) the ticket is about.
- Tests never touch `data/db.json` (use in-memory fixtures only).
- Add no new dependencies.
