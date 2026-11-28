# ShopLedger

## Stack

- Node.js with CommonJS, Express 4, and body-parser for JSON requests.
- Plain HTML, CSS, and browser JavaScript served by Express.
- Synchronous filesystem persistence in `data/db.json`.

## Module map

- `server.js` serves the UI, mounts the API routers, and serves printable invoices. `config.js` holds shop, tax, inventory, and coupon settings.
- `public/` contains the billing desk, order register, khata screens, and audit views.
- `routes/` contains the products, orders, customers, and reports routers. The reports router also handles cart previews and the database export.
- `lib/` contains order, inventory, pricing, coupon, tax, ledger, reporting, invoice, date, and storage logic.

## Commands

- `npm start` runs `node server.js`.
- `node --test` runs the test suite.
- `npm test` is a placeholder that prints an error and exits with status 1.

## Rules

- Write characterization tests that capture existing behavior before changing behavior.
- Change only the module the ticket is about.
- Tests must never read from or write to `data/db.json`.
- Add no dependencies.
