# CP1 — Explain (read-only)

Working folder: `shopledger`  
Mode: **read-only** — this explanation was prepared from source inspection before code changes; no files were changed, dependencies installed, or server started during that inspection.

## What the app does

ShopLedger is a browser-based point-of-sale app for a kirana and wholesale shop. It supports a product catalog, cart pricing with GST and coupons, stock reservations, cash and Khata orders, order history and cancellation, customer credit settlements, GST reconciliation, and printable invoices.

## Module map

- `public/`: UI HTML, browser JS, and CSS.
- `server.js`: configures Express/static serving, mounts API routers, and serves printable invoices.
- `routes/products.js`: product list and active coupons.
- `routes/orders.js`: order listing/lookup, checkout, cancellation.
- `routes/customers.js`: Khata accounts and settlement endpoint.
- `routes/reports.js`: dashboard, GST reconciliation, pricing preview, admin export.
- `lib/orders.js`: order operations and history filters.
- `lib/pricing.js`, `lib/tax.js`, `lib/coupons.js`: checkout calculations.
- `lib/invoice.js`: invoice totals and HTML rendering.
- `lib/inventory.js`: sellable stock and reservations.
- `lib/ledger.js`: customer balances and settlements.
- `lib/reports.js`: dashboard and reconciliation calculations.
- `lib/store.js`: JSON file persistence and audit log.
- `config.js`: port, shop identity, GST slabs, coupons, inventory defaults.
- `data/db.json`: persisted products, orders, customers, and audit data.

## What happens when an order is placed

The browser posts item IDs, quantities, coupon, payment mode, and optional customer details to `POST /api/orders`. The route reads the database, resolves product details, checks stock and coupon eligibility, then calls `lib/pricing.computeTotals`. For Khata payments it charges the customer's ledger. It reserves inventory, creates the order with calculated subtotal/discount/tax/total, appends an audit entry, and writes the updated JSON database. It returns the new order. The invoice route later reads that order and asks `lib/invoice` to independently recalculate its totals.

## Risks and age

- `data/db.json` is the live persistence layer; checkout and cancellations can modify tracked data.
- `config.js` contains a hard-coded admin key.
- `lib/invoice.js` independently recomputes order totals, risking disagreement with the checkout ledger.
- `package.json` has no real test script and the app has no existing tests.
- Dependencies are old Express 4/body-parser packages; there is no lockfile.
- Several source files use older `var`/callback style.

## I am sure

- The app is Express/Node with static browser files, route modules, and JSON storage.
- Checkout uses `lib/pricing.computeTotals`; invoice rendering uses `lib/invoice.computeInvoiceFigures`.
- Orders persist calculated amounts that can be used to render the customer's billed figures.
- Tests can use built-in `node:test` without adding a dependency.

## I suspect

- Independent invoice recalculation is the direct reason the reconciliation tab flags mismatches, because invoice logic applies coupon discounts to tax-inclusive totals and defaults missing `gstRate` to 18% instead of resolving HSN slabs.
- The old runtime dependencies may have security or compatibility issues; this requires a dependency audit to confirm.
