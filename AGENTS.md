# ShopLedger contributor guide

## Stack

- Node.js with CommonJS modules
- Express 4 and body-parser
- Plain HTML, CSS, and browser JavaScript
- JSON-file persistence in `data/db.json`
- Tests use the built-in `node:test` runner

## Module map

- `server.js`: application setup, static assets, API mounting, and printable invoices
- `routes/`: HTTP handlers for products, orders, customers, pricing, and reports
- `lib/pricing.js`, `lib/tax.js`, `lib/coupons.js`: checkout calculations
- `lib/invoice.js`, `lib/reports.js`: accountant invoices and reconciliation
- `lib/inventory.js`, `lib/orders.js`, `lib/ledger.js`: stock, orders, and khata accounts
- `lib/store.js`: reads and writes `data/db.json`
- `public/`: the browser interface

## Commands

- Start the app: `node server.js` or `npm start`
- Run all tests: `node --test`

## Change rules

- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never read or write `data/db.json`; use in-memory fixtures.
- Add no dependencies.
