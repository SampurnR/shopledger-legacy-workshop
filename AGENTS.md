# ShopLedger project instructions

## Stack

- Node.js application using Express.
- JavaScript source files; tests should use Node's built-in `node:test` module.
- JSON data is stored in `data/db.json`.
- The application starts with `npm start` and runs `server.js`.

## Module map

- `server.js`: Express application entry point.
- `routes/`: HTTP route handlers for customers, orders, products, and reports.
- `lib/`: business logic for coupons, dates, inventory, invoices, ledger, orders, pricing, reports, store access, and tax.
- `public/`: browser UI, styles, and client-side JavaScript.
- `config.js`: application configuration.
- `data/db.json`: application data store.

## Rules

- Write characterization tests before changing behavior.
- Change only the module related to the ticket.
- Tests must never modify `data/db.json`; use in-memory or temporary data instead.
- Add no new dependencies.
