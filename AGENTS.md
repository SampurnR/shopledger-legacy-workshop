# Repository guidance

## Current stack

- Node.js application using Express 4 and body-parser.
- Browser UI consists of plain HTML, JavaScript, and CSS in `public/`.
- Application data is stored in `data/db.json` through `lib/store.js`.
- Tests use Node.js built-in `node:test` and `node:assert/strict`; no test dependencies are needed.

## Module map

- `server.js` configures Express, serves `public/`, mounts the API routers, and serves printable invoices.
- `routes/` contains the products, orders, customers, and reports API routers.
- `lib/` contains store persistence, order handling, pricing, tax, coupons, inventory, customer ledger, invoices, reports, and date utilities.
- `config.js` contains port, shop, tax, inventory, and coupon configuration.
- `data/db.json` contains product, customer, order, settlement, and audit data.
- `public/` contains the browser interface and its styles and client-side behavior.
- `tests/invoice-current-behaviour.test.js` contains characterization tests for invoice, pricing, reconciliation, and rendering behavior.
- `tests/invoice-correct-behaviour.test.js` contains invoice regression tests for HSN GST rates and SAVE10 calculations.

## Commands

- `npm start` starts the application with `node server.js`.
- `node --test` runs the existing test suite.
- `npm test` is still a placeholder; it prints `Error: no test specified` and exits with status 1.

## Change rules

- Write **characterization tests** before changing behaviour.
- Change only the module the ticket is about.
- Tests must never read from or write to `data/db.json`.
- Add no dependencies.
