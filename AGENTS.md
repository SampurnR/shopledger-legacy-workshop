# ShopLedger

## Stack
- Node.js application using Express 4 and body-parser.
- Browser UI is static HTML, CSS, and JavaScript served from `public/`.
- Records are stored in `data/db.json` through synchronous filesystem operations.

## Module map
- `routes/customers.js` — customers, settlements, and customer balances.
- `routes/orders.js` — order listing, retrieval, creation, and cancellation.
- `routes/products.js` — product catalog and coupons.
- `routes/reports.js` — pricing preview, dashboard, reconciliation, and admin export.
- `lib/coupons.js` — coupon normalization, validation, calculation, and listing.
- `lib/dates.js` — current date and date normalization helpers.
- `lib/inventory.js` — product lookup, stock checks, reservation, release, and summary.
- `lib/invoice.js` — invoice calculations and printable invoice HTML.
- `lib/ledger.js` — customer balances, Khata charges/reversals, and settlements.
- `lib/orders.js` — order operations.
- `lib/pricing.js` — shared subtotal, discount, and checkout total calculations.
- `lib/reports.js` — dashboard summaries and GST invoice reconciliation.
- `lib/store.js` — JSON store reads/writes and audit records.
- `lib/tax.js` — GST rate resolution and CGST/SGST splitting.

## Commands
- Start: `node server.js` or `npm start`.
- Tests: `node --test` (the existing `npm test` script is a placeholder).

## Safe change rules
1. Write characterization tests before changing behavior.
2. Change only the module(s) the ticket is about.
3. Tests use in-memory data and never read or write `data/db.json`.
4. Add no dependencies.
5. Make the smallest fix that works.
