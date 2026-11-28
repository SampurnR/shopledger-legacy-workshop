# ShopLedger project notes

## Stack

- Node.js, CommonJS JavaScript, Express 4, and body-parser.
- The browser UI is plain HTML, CSS, and JavaScript served from `public/`.
- Application data is stored in `data/db.json` through `lib/store.js`.

## Module map

- `server.js` configures Express, static assets, API routers, and the printable invoice route.
- `routes/` contains the product, order, customer, and report API routes.
- `lib/` contains inventory, pricing, tax, coupon, order, ledger, report, invoice, date, and JSON-store logic.
- `config.js` holds the port, shop details, tax/HSN slabs, inventory defaults, and coupon definitions.
- `public/` contains the POS and reporting UI; `data/db.json` contains products, orders, customers, settlements, audit entries, and ID counters.

## Commands

- `npm start` starts the Express server on the configured port (default 3000).
- `node --test` runs the built-in Node.js test runner for tests under `test/`.
- `npm test` is currently a placeholder that exits with “no test specified”.

## Change rules

- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never read or write `data/db.json`; use in-memory data.
- Add no dependencies.
