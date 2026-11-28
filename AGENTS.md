# Repository Guidelines

## Stack

ShopLedger is a CommonJS Node.js application using Express 4 and `body-parser`. Express serves the browser app from `public/` and exposes JSON APIs. `lib/store.js` synchronously reads and writes `data/db.json`; there is no database server or build step.

## Module Map

- `server.js` starts Express and mounts the route modules.
- `routes/` handles product/catalog, order, customer/settlement, and report/pricing-preview requests.
- `lib/` contains pricing, coupons, tax, inventory, orders, customer ledger, invoice, reporting, date, and storage logic.
- `public/` contains `index.html`, browser code in `js/app.js`, and styles in `css/style.css`.
- `config.js` holds shop, tax, inventory, coupon, and port settings; `data/db.json` holds application records.

## Commands

- `npm start` runs the server at `http://localhost:3000` (or the port in `PORT`).
- `npm test` currently runs a placeholder that exits with an error; no test runner is configured.
- There is no build or lint command.

## Contribution Rules

- Before changing behavior, write characterization tests that capture the current behavior.
- Change only the module the ticket is about; avoid unrelated edits.
- Tests must never read from or write to `data/db.json`; use isolated test data.
- Do not add dependencies.

