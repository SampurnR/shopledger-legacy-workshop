# ShopLedger

## Stack
- Node.js, CommonJS, Express, and body-parser; static HTML, CSS, and JavaScript frontend.
- Persistence uses `data/db.json` via `lib/store.js`.

## Module map
- `routes/customers.js`: customer listing and Khata settlements.
- `routes/orders.js`: order listing, lookup, creation, and cancellation.
- `routes/products.js`: product listing and active coupons.
- `routes/reports.js`: dashboard, GST reconciliation, pricing preview, and admin export.
- `lib/coupons.js`: coupon normalization, validation, calculation, and listing.
- `lib/dates.js`: date formatting, normalization, and fiscal-year calculation.
- `lib/inventory.js`: product lookup, stock checks and updates, and inventory summary.
- `lib/invoice.js`: invoice figure calculation and printable HTML rendering.
- `lib/ledger.js`: customer balances, Khata charges and reversals, and settlements.
- `lib/orders.js`: order creation, lookup, cancellation, and listing.
- `lib/pricing.js`: subtotal, discount, tax, and total calculations.
- `lib/reports.js`: dashboard summary and GST reconciliation.
- `lib/store.js`: JSON database reads, writes, and audit entries.
- `lib/tax.js`: item GST rates and CGST/SGST split.

## Commands
- Start the app: `node server.js`.
- Run tests: `node --test`. The `npm test` script currently exits with an error.

## Rules
1. Write characterization tests before changing behaviour.
2. Change only the module(s) the ticket is about.
3. Tests never read or write `data/db.json`; use in-memory data.
4. Add no dependencies.
5. Make the smallest fix that works.

## Current ticket
Order history sorting and date filtering are broken: `orders.list` compares dates as strings in `DD/MM/YYYY` format. Khata settlements can corrupt balances when a string amount is added to `totalSettled`.

Allowed implementation files: `lib/orders.js` (`list` only), `lib/dates.js`, `lib/ledger.js`, and `routes/customers.js`.
