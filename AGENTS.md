# ShopLedger agent notes

## Project at a glance

- ShopLedger is a Node.js application using CommonJS, Express 4, and `body-parser`.
- The browser UI is plain HTML, CSS, and JavaScript under `public/` and is served as static files by Express.
- Persistent application data is stored in `data/db.json` through `lib/store.js`.
- The server entry point is `server.js`; the default port is `3000` and can be overridden with `PORT`.

## Module map

- `server.js` creates the Express app, serves the UI, mounts API routers, and serves printable HTML invoices.
- `routes/products.js` serves product search/listing and active coupons.
- `routes/orders.js` serves order lookup/listing, order creation, and cancellation.
- `routes/customers.js` serves customer and settlement data and records khata settlements.
- `routes/reports.js` serves dashboard and GST reconciliation reports, pricing preview, and admin export.
- `lib/store.js` reads/writes `data/db.json` and appends audit entries.
- `lib/orders.js` manages order records and cancellation.
- `lib/inventory.js` calculates sellable stock and checks, deducts, or releases stock.
- `lib/ledger.js` manages customer balances, khata charges, reversals, and settlements.
- `lib/pricing.js`, `lib/tax.js`, and `lib/coupons.js` calculate totals, GST, and coupon discounts.
- `lib/invoice.js` calculates invoice figures and renders printable invoice HTML.
- `lib/reports.js` builds dashboard summaries and GST reconciliation results.
- `lib/dates.js` formats today's date and normalizes date strings.
- `config.js` contains the port, shop details, GST slab mapping, inventory defaults, and coupon definitions.

## Commands

- `npm start` — start the Express server.
- `npm test` — currently runs a placeholder that exits with an error; no test suite is configured in `package.json`.

## Change rules

1. Write characterization tests before changing behavior.
2. Change only the module the ticket is about.
3. Tests must never touch `data/db.json`.
4. Add no dependencies.
5. Keep these notes limited to facts that are true in the current project; verify them against the source when updating this file.
