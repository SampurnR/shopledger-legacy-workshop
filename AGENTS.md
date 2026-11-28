# ShopLedger contributor guide

## Stack

- Node.js with Express 4 and `body-parser`
- Browser UI served from `public/`
- JSON persistence in `data/db.json`
- Built-in `node:test` for tests

## Module map

- `server.js` configures Express, static files, API routers, and printable invoices.
- `routes/` exposes products, orders, customers, and reports APIs.
- `lib/pricing.js`, `lib/tax.js`, and `lib/coupons.js` calculate checkout totals.
- `lib/invoice.js` renders printable tax invoices.
- `lib/store.js` reads and writes the JSON database.
- `data/db.json` is the application data file.

## Commands

- `npm start` starts the app on port 3000 by default.
- `node --test` runs the test suite.

## Rules

1. Write characterization tests before changing behaviour.
2. Change only the module the ticket is about.
3. Tests must never touch `data/db.json`.
4. Add no dependencies.
