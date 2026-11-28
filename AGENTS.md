# ShopLedger

## Stack

- Node.js CommonJS application.
- Express 4 with `body-parser`.
- Browser UI: static HTML, CSS, and vanilla JavaScript in `public/`.
- File-backed data store: `data/db.json`.
- Node built-in tests live in `test/` and run with `node --test`.

## Module map

- `server.js`: Express setup, static UI, route mounting, printable invoice page.
- `routes/`: HTTP endpoints for products, orders, customers, and reports.
- `lib/store.js`: reads, writes, and audits `data/db.json`.
- `lib/inventory.js`, `pricing.js`, `coupons.js`, `tax.js`: stock and order-total rules.
- `lib/orders.js`, `ledger.js`, `dates.js`: order, Khata, and date rules.
- `lib/reports.js`, `invoice.js`: reporting, reconciliation, and invoice rendering.
- `config.js`: port, shop, tax, inventory, and coupon configuration.

## Commands

```bash
npm install
npm start
node --test
```

`npm test` currently exits with `Error: no test specified`.

## Change rules

- Write characterization tests before changing behaviour.
- Change only module ticket is about.
- Tests never touch `data/db.json`; use in-memory data.
- Add no dependencies.
