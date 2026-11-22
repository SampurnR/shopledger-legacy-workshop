# Repository Guidelines

## Stack

ShopLedger is a Node.js application using Express 4 and CommonJS modules. The browser interface is plain HTML, CSS, and JavaScript. Runtime data is stored in `data/db.json`; there is no database server or frontend framework in this repository.

## Module Map

- `server.js` configures Express, serves `public/`, and mounts routes.
- `routes/` contains the products, orders, customers, and reports API routers.
- `lib/` contains order and pricing logic, inventory, coupons, tax, customer ledger, reports, invoice rendering, date helpers, and JSON storage.
- `config.js` holds shop, tax, coupon, inventory, and port settings.
- `public/` contains the POS and reporting UI and its assets; `data/db.json` is the local data file.

## Commands

- `npm start` starts the app (`PORT` if set, otherwise port `3000`).
- `npm test` is currently a placeholder that exits with an error; no test framework or build command is configured.

## Change Rules

- Write characterization tests before changing behavior.
- Change only the module the ticket is about; avoid unrelated cleanup or edits.
- Tests must never read from or write to `data/db.json`. Use isolated test data.
- Add no dependencies. Use the packages already present in `package.json`.
