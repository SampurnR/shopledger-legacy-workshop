# Repository Guidelines

## Stack

ShopLedger is a Node.js CommonJS application using Express 4 and `body-parser`. The server serves a static browser UI from `public/` and persists application data in `data/db.json` through `lib/store.js`.

## Module Map

- `server.js` — Express setup and route mounting.
- `routes/` — product, order, customer, and report API handlers.
- `lib/` — inventory, orders, pricing, tax, coupons, ledger, invoices, reports, dates, and JSON storage.
- `public/` — browser UI (`index.html`, `js/`, `css/`).
- `config.js` — port, shop metadata, tax slabs, inventory defaults, and coupon configuration.
- `test/` — Node.js built-in test-runner tests.
- `data/db.json` — local application records.

## Commands

- `npm start` — start the server at `http://localhost:3000` by default; `PORT` overrides it.
- `npm test` — run tests with `node --test`.

There is no separate build command in `package.json`.

## Working Rules

1. Write characterization tests before changing behavior.
2. Change only the module the ticket is about.
3. Tests must use an isolated database and never touch `data/db.json`.
4. Add no dependencies.
