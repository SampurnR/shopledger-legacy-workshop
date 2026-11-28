# ShopLedger contributor guide

## Stack

- Node.js with CommonJS modules
- Express 4 and `body-parser`
- A browser UI in `public/`
- JSON persistence in `data/db.json`
- Tests use the built-in `node:test` runner and `node:assert`

## Module map

- `server.js`: Express application entry point and route mounting
- `routes/`: HTTP handlers for products, orders, customers, and reports
- `lib/orders.js`: order creation, lookup, cancellation, and filtering
- `lib/pricing.js`: checkout subtotal, discount, GST, and total calculation
- `lib/invoice.js`: printable invoice figures and HTML rendering
- `lib/inventory.js`: sellable-stock checks and stock mutations
- `lib/ledger.js`: customer credit balances and settlements
- `lib/coupons.js`: coupon validation and discount rules
- `lib/tax.js`: HSN GST rates and CGST/SGST splitting
- `lib/reports.js`: dashboard and GST reconciliation
- `lib/dates.js`: Indian date formatting and fiscal-year helpers
- `lib/store.js`: JSON reads, writes, and audit entries
- `config.js`: shop, GST, inventory, coupon, and port configuration
- `data/db.json`: application data; never use it as mutable test state

## Commands

- `npm start`: start the server on the configured port
- `npm test`: run the test suite
- `node --test`: run the test suite directly

## Change rules

1. Add characterization tests before changing behaviour.
2. Change only the module or modules the selected ticket is about.
3. Tests must use in-memory fixtures and must never modify `data/db.json`.
4. Add no dependencies unless the ticket explicitly requires one.
