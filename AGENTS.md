# Repository Guidelines

## Stack

ShopLedger runs on Node.js with Express and body-parser. The UI is static HTML, CSS, and browser JavaScript served from `public/`. Application data is persisted in `data/db.json`; `config.js` holds shop, tax, coupon, and inventory settings.

## Module Map

- `server.js` serves the UI and mounts the API routers.
- `routes/` contains `products.js`, `orders.js`, `customers.js`, and `reports.js`.
- `lib/` contains `store.js` (JSON persistence), `orders.js`, `inventory.js`, `ledger.js`, `pricing.js`, `coupons.js`, `tax.js`, `reports.js`, `invoice.js`, and `dates.js`.
- `public/` contains `index.html`, `js/app.js`, and `css/style.css`.

## Commands

- `npm start` runs `node server.js`; the default port is 3000 and can be overridden with `PORT`.
- `npm test` is currently a placeholder that exits with an error; no test framework is configured.

## Change Rules

- Before changing behavior, write characterization tests for the behavior being changed.
- Change only the module the ticket is about; avoid unrelated edits.
- Tests must never read or write `data/db.json`. Use isolated fixtures or temporary data instead.
- Do not add dependencies. Use the packages already declared in `package.json` and built-in Node.js features.
