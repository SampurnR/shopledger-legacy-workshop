# AGENTS.md — ShopLedger

## Stack
- **Runtime:** Node.js (CommonJS)
- **Backend:** Express `^4.17.1`, `body-parser ^1.19.0`
- **Frontend:** Vanilla HTML, CSS, and ES5-style browser JavaScript (`public/index.html`, `public/js/app.js`, `public/css/style.css`) using `XMLHttpRequest`
- **Persistence:** Single JSON flat file at `data/db.json` read/written via `lib/store.js`
- **Tests:** Node.js built-in `node:test` and `node:assert/strict` (`test/shopledger.test.js`)

## Module Map
- `server.js` — Express entry point (`PORT || 3000`), JSON parse middleware, static serving for `public/`, `/api` mounts, and `GET /orders/:id/invoice`
- `config.js` — Shop metadata, `adminKey`, GST default rate and `hsnSlabs` (5%, 12%, 18%), inventory defaults, and coupon definitions
- `routes/products.js` — `GET /api/products`, `GET /api/coupons`
- `routes/orders.js` — `GET /api/orders`, `GET /api/orders/:id`, `POST /api/orders`, `POST /api/orders/:id/cancel`
- `routes/customers.js` — `GET /api/customers`, `POST /api/customers/:id/settle`
- `routes/reports.js` — `GET /api/reports/dashboard`, `GET /api/reports/gst-reconciliation`, `POST /api/pricing/preview`, `GET /api/admin/export`
- `lib/store.js` — Synchronous JSON read, atomic temp-file rename write, and bounded `auditLog` helper
- `lib/inventory.js` — Product lookup, sellable stock (`stock - reserved`), stock checks, deduction (`reserve`), cancellation restock (`release`), and summary
- `lib/coupons.js` — Coupon code normalization, validation (`active`, `minOrder`), and discount calculation (`maxDiscount`)
- `lib/pricing.js` — Cart subtotal, apportioned line discounts, and HSN-based GST totals
- `lib/tax.js` — Item GST rate lookup (`gstRate` / `hsn` / `defaultRate`) and CGST/SGST split
- `lib/ledger.js` — Customer Khata balance calculations, credit limit enforcement, order debit/reversal, and settlements
- `lib/orders.js` — Order creation, lookup, cancellation, and chronological filtering/sorting
- `lib/dates.js` — `DD/MM/YYYY` formatting, `YYYY-MM-DD` comparable date keys, and Indian fiscal year calculation
- `lib/invoice.js` — Printable HTML GST tax invoice renderer and figure computation
- `lib/reports.js` — Dashboard KPIs and Order Ledger vs. Invoice GST reconciliation
- `data/db.json` — Tracked JSON database (`products`, `customers`, `orders`, `settlements`, `auditLog`, ID counters)
- `docs/architecture.svg` — System architecture and order placement flow diagram

## Commands
- Install dependencies: `npm install` (creates untracked `package-lock.json`; do not commit `package-lock.json`)
- Start server (`http://localhost:3000`): `npm start`
- Run test suite: `npm test` (or `node --test`)

## Rules
1. **Write characterization tests before changing behaviour.** Record current behaviour first (`node:test`) before altering legacy logic.
2. **Change only the module(s) the ticket is about.** Keep changes minimal and scoped to the relevant ticket module(s).
3. **Tests must never touch `data/db.json`.** Use in-memory data or an isolated temporary copy so `data/db.json` stays untouched.
4. **Add no dependencies.** Use only existing dependencies (`express`, `body-parser`) and built-in Node.js modules.
