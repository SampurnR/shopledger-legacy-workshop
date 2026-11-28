# Repository Guidelines

## Stack

ShopLedger is a Node.js application using Express 4, `body-parser`, and CommonJS JavaScript. The browser UI is plain HTML, CSS, and JavaScript; there is no frontend build step. The application reads and writes `data/db.json` as its database.

## Module Map

- `server.js` serves `public/`, mounts the routers under `/api`, and serves printable HTML invoices.
- `routes/products.js` lists products and coupons; `routes/orders.js` creates, lists, retrieves, and cancels orders.
- `routes/customers.js` lists customer balances and records khata settlements; `routes/reports.js` serves the dashboard, GST reconciliation, pricing preview, and data export.
- `lib/inventory.js` handles stock; `lib/pricing.js`, `lib/tax.js`, and `lib/coupons.js` calculate checkout amounts.
- `lib/orders.js`, `lib/ledger.js`, and `lib/dates.js` handle order records, customer credit, and dates. `lib/invoice.js` renders invoices; `lib/reports.js` calculates summaries and reconciliation; `lib/store.js` persists JSON.
- `config.js` holds shop, tax, coupon, inventory, and port settings. `public/index.html`, `public/js/app.js`, and `public/css/style.css` make up the UI.

## Commands

- `npm start` starts `server.js` on `PORT` or port 3000.
- `node --check server.js` checks syntax without starting the server; use the changed `.js` file path for other modules.
- `npm test` currently exits with “Error: no test specified.” No test runner, build, lint, or format command is configured.

## Change Rules

1. Write characterization tests that capture current behavior **before** changing behavior.
2. Change only the production module the ticket is about, plus its necessary characterization tests.
3. Tests must never read from or write to `data/db.json`; use in-memory fixtures or isolated temporary files.
4. Add no dependencies.
