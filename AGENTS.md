# ShopLedger contributor instructions

## Stack

- Node.js 22 using CommonJS modules.
- Express 4 with `body-parser`.
- Plain HTML, CSS, and browser JavaScript using `XMLHttpRequest`.
- JSON-file persistence in `data/db.json`.
- Tests use the built-in `node:test` and `node:assert` modules.

## Module map

- `server.js`: Express application setup, static files, API routers, and invoice page.
- `config.js`: shop, tax, inventory, coupon, port, and admin settings.
- `public/`: dashboard markup, styles, and browser-side behavior.
- `routes/`: product, order, customer, pricing, and reporting HTTP endpoints.
- `lib/`: orders, inventory, pricing, tax, coupons, ledger, dates, invoices, reports, and JSON storage.
- `data/db.json`: primary application data.
- `docs/architecture.md`: current architecture and order-flow diagrams.

## Commands

Use Node.js 22 for project commands:

```sh
nvm use 22
npm start
node --test
```

## Rules

1. Write characterization tests before changing behavior.
2. Change only the module the ticket is about.
3. Tests must never read or write `data/db.json`; use in-memory data.
4. Add no dependencies.
