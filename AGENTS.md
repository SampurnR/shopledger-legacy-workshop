# Repository Guidelines

## Stack and Module Map

ShopLedger uses Node.js, Express 4, and `body-parser` for its server and JSON API. The browser UI is plain HTML, CSS, and JavaScript. Persistence is a JSON file; there is no database server or frontend build step.

`server.js` serves `public/`, mounts the API routers, and renders the invoice route. `routes/` contains `products.js`, `orders.js`, `customers.js`, and `reports.js`. `lib/` contains `store.js` (JSON persistence and audit log), `orders.js`, `inventory.js`, `pricing.js`, `tax.js`, `coupons.js`, `ledger.js`, `reports.js`, `invoice.js`, and `dates.js`. Business settings are in `config.js`; application records are in `data/db.json`; UI files are in `public/`.

## Commands

- `npm start` runs `node server.js` (default port 3000; override with `PORT`).
- `npm test` is a placeholder that exits with an error; no test framework or test suite is configured.

## Change and Test Rules

Before changing behavior, write characterization tests for the current behavior. Change only the module named in the ticket; do not make unrelated cleanup or cross-module edits. Tests must never read or write `data/db.json`. Do not add dependencies.
