# CP1 — Explain (read-only)

## What the app does
ShopLedger is a small wholesale and retail point-of-sale app with product inventory, coupon pricing, customer Khata credit, order history, printable GST invoices, and audit/report views. The browser UI is served by a Node.js/Express server. Application data is stored in `data/db.json`.

## Module map
- `public/` contains the browser interface.
- `server.js` configures Express and mounts the routers.
- `routes/orders.js`, `routes/products.js`, `routes/customers.js`, and `routes/reports.js` expose the app's HTTP endpoints.
- `lib/orders.js`, `lib/inventory.js`, `lib/ledger.js`, `lib/pricing.js`, `lib/coupons.js`, `lib/tax.js`, `lib/invoice.js`, `lib/reports.js`, `lib/dates.js`, and `lib/store.js` implement business operations.
- `config.js` holds GST slabs, coupon rules, shop details, and app settings.

## Order flow (based on the source)
The browser sends an order request to the Express orders route. The route reads the JSON store, validates the order and inventory, calculates checkout totals through the pricing and tax/coupon modules, reserves inventory, records any Khata debit, appends the order, writes the updated store, and returns a response. Invoice rendering reads an order and produces printable HTML.

## Risks and areas to verify
- The JSON store is synchronously read/written, so concurrent writes and partial failures deserve care.
- Several routes appear to mutate live in-memory data from the JSON file; tests must use isolated in-memory objects and must not touch `data/db.json`.
- Invoice logic is a separate path from shared checkout pricing, which can cause the selected GST/discount reconciliation issue.
- `npm test` is currently a placeholder; use Node's built-in test runner with `node --test`.
- The repository contains legacy configuration/comments and should be changed narrowly.

## Confidence
- **I am sure:** These files, module names, commands, and configured dependencies are present in the checkout.
- **I suspect:** Synchronous JSON writes could cause lost updates under concurrent requests; that is a risk to investigate, not a confirmed ticket cause.

No files were changed during the CP1 read-only inspection itself.
