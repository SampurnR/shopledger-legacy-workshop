# ShopLedger contributor notes

## Stack

- Node.js application using Express 4 and `body-parser`.
- Vanilla HTML, CSS, and JavaScript frontend served from `public/`.
- File-backed persistence: `data/db.json` is read and written by `lib/store.js`.
- No build tool, ORM, database server, or automated test suite is currently configured.

## Module map

- `server.js` configures Express, serves `public/`, mounts the API routers, and exposes the printable invoice page.
- `routes/` contains HTTP handlers:
  - `products.js`: product catalog and coupons.
  - `orders.js`: order creation, retrieval, filtering, and cancellation.
  - `customers.js`: Khata customers and settlements.
  - `reports.js`: dashboard, GST reconciliation, pricing preview, and export.
- `lib/` contains business logic:
  - `pricing.js`, `tax.js`, and `coupons.js`: totals, GST, and discounts.
  - `inventory.js`, `orders.js`, and `ledger.js`: stock, order lifecycle, and Khata balances.
  - `reports.js`, `invoice.js`, and `dates.js`: reporting, printable invoices, and date utilities.
  - `store.js`: JSON read/write and audit-log operations.
- `config.js` contains shop configuration, tax slabs, inventory defaults, and coupons.
- `data/db.json` contains products, orders, customers, settlements, and audit records.

## Commands

```sh
npm install
npm start
node --test
```

`npm start` runs `node server.js`. The current `npm test` script intentionally exits with “no test specified”; use Node's built-in test runner (`node --test`) when tests are added.

## Rules

1. Write characterization tests before changing behavior.
2. Change only the module the ticket is about.
3. Tests must never touch `data/db.json`; use in-memory data or a temporary test fixture.
4. Add no dependencies.
