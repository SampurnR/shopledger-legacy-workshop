# AGENTS.md — ShopLedger Standing Instructions

## 1. Project Overview & Tech Stack
ShopLedger is a legacy Node.js monolith for wholesale & retail billing, inventory management, Khata credit ledger, and GST invoicing for Corner Shop Kirana & Wholesale (Pune, Maharashtra).

- **Runtime:** Node.js (v22+ recommended, tested on Node 26)
- **Framework:** Express 4.17.1, body-parser 1.19.0
- **Database:** Single-file JSON store located at `data/db.json`
- **Testing:** Node.js native test runner (`node:test`, `node:assert`)
- **Frontend:** Vanilla JS / HTML5 SPA served from `public/`

## 2. Module Map

### Root Files
- `server.js`: Express application bootstrap, JSON middleware, static asset serving, and `/orders/:id/invoice` HTML rendering.
- `config.js`: Port configuration, shop metadata (GSTIN, Pune address), HSN GST tax slabs (5%, 12%, 18%), and coupon rules (SAVE10, FLAT50, WELCOME, WHOLESALE15).

### API Routes (`routes/`)
- `routes/orders.js`: Order creation (`POST /api/orders`), listing with filters (`GET /api/orders`), order lookup (`GET /api/orders/:id`), and order cancellation (`POST /api/orders/:id/cancel`).
- `routes/products.js`: Product catalog listing, search, and stock queries (`GET /api/products`, `GET /api/products/:id`).
- `routes/customers.js`: Customer Khata accounts listing (`GET /api/customers`) and balance settlements (`POST /api/customers/:id/settle`).
- `routes/reports.js`: Dashboard financial summaries (`GET /api/reports/summary`) and GST reconciliation audit (`GET /api/reports/reconciliation`).

### Business Logic Modules (`lib/`)
- `lib/store.js`: Database operations reading and writing to `data/db.json`, plus audit logging.
- `lib/pricing.js`: Subtotal calculation, coupon discount apportionment across line items, and post-discount HSN GST calculation (`computeTotals`).
- `lib/tax.js`: HSN code rate lookup (`getRateForItem`), GST slab percentage (`getSlabPercent`), and 50/50 CGST & SGST splitting (`splitCgstSgst`).
- `lib/coupons.js`: Coupon normalization, validation against minOrder, and discount computation with caps (`calculateDiscount`).
- `lib/inventory.js`: Stock lookups, sellable stock calculation (excluding reserved wholesale units), stock availability checks (`check`), stock reservation (`reserve`), and restocking (`release`).
- `lib/ledger.js`: Customer Khata accounts, credit limit checking, order debits (`chargeOrderToKhata`), debit reversals (`reverseOrderDebit`), and settlements (`recordSettlement`).
- `lib/invoice.js`: Printable tax invoice generation (`render`) and invoice figure computation (`computeInvoiceFigures`).
- `lib/orders.js`: Order creation, retrieval, cancellation lifecycle, search, and date-range filtering.
- `lib/reports.js`: High-level financial KPIs and Accountant Invoice vs. Ledger reconciliation engine (`getGstReconciliation`).
- `lib/dates.js`: Indian date format utilities (`DD/MM/YYYY`) and fiscal year calculations.

## 3. Commands
- **Install dependencies:** `npm install` (Note: do not commit `package-lock.json`)
- **Start server:** `npm start` (or `node server.js`)
- **Run tests:** `node --test`

## 4. Strict Engineering Rules
1. **Characterization Tests First:** Always pin existing behavior with characterization tests using `node:test` before changing any behavior. Flag buggy existing behavior with `"CURRENT BEHAVIOUR"` in test titles.
2. **Single Module Scope:** Change only the module(s) your specific ticket is about. Do not refactor unrelated files.
3. **Never Touch Real Data in Tests:** Tests must use in-memory mock objects or temporary structures. Never read from or write to `data/db.json` during test runs.
4. **No New Dependencies:** Do not add npm packages. Use Node.js built-ins (`node:test`, `node:assert`, `node:path`, `node:fs`).
