# ShopLedger

## Stack

- Node.js application using CommonJS (`require` / `module.exports`).
- Express 4 with body-parser 1 for JSON request bodies; app version is 0.8.4.
- Plain HTML, CSS, and browser JavaScript using XMLHttpRequest.
- Local JSON persistence through synchronous Node.js filesystem reads and writes.

## Module map

| Path | Responsibility |
| --- | --- |
| `server.js` | Express entry point; serves `public/`, mounts routers under `/api`, and serves `/orders/:id/invoice`. |
| `config.js` | Port, shop details, admin key, GST slabs, inventory defaults, and coupon definitions. |
| `routes/` | `products.js`: catalog and coupons; `orders.js`: order reads, creation, and cancellation; `customers.js`: customer reads and settlements; `reports.js`: dashboard, GST reconciliation, pricing preview, and admin export. |
| `lib/` | `pricing.js`, `tax.js`, `coupons.js`: checkout calculations; `inventory.js`: stock; `orders.js`: order records; `ledger.js`: Khata balances and settlements; `invoice.js`: separate printable-invoice calculation and HTML rendering; `reports.js`: summaries and reconciliation; `dates.js`: date helpers; `store.js`: persistence and audit entries. |
| `public/` | `index.html`, `css/style.css`, and `js/app.js`: POS, order register, Khata, inventory, and GST reconciliation interface. |
| `data/db.json` | Products, customers, orders, settlements, audit log, and order/settlement ID counters. |
| `docs/architecture.svg` | Architecture diagram and order-placement flow. |

## Commands

Run these from the repository root:

| Command | Current behavior |
| --- | --- |
| `npm start` | Runs `node server.js`; listens on `PORT`, defaulting to 3000. |
| `node server.js` | Starts the same application directly. |
| `npm test` | Prints `Error: no test specified` and exits with status 1; it is a placeholder, not a working test suite. |

## Change rules

1. Write characterization tests before changing behaviour; capture the module's current observable behaviour before modifying it.
2. Change only the module the ticket is about; avoid unrelated fixes, refactors, or formatting changes.
3. Tests must never touch `data/db.json`: do not read, write, reset, replace, or delete it. Use isolated fixtures and stub persistence calls before exercising code that accesses the store.
4. Add no dependencies.
