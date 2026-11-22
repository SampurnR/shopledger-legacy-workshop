# ShopLedger repository guide

## Stack

- Node.js application using Express 4 and `body-parser`.
- Browser UI is plain HTML, CSS, and JavaScript under `public/`.
- Persistent application data is stored in `data/db.json` through `lib/store.js`.
- Runtime configuration is in `config.js`.

## Module map

- `server.js`: creates the Express app, serves `public/`, mounts API routers, and serves the HTML invoice route.
- `routes/`: HTTP endpoints for products and coupons, orders and cancellation, customers and settlements, pricing preview, reports, and admin export.
- `lib/`: business logic for orders, inventory, pricing, tax, coupons, customer ledger, reporting, invoices, dates, and JSON-file storage.
- `public/`: single-page UI (`index.html`, `js/app.js`) and styles (`css/style.css`).
- `data/db.json`: current product, order, customer, settlement, and audit data.

## Commands

- `npm start` — starts the app with `node server.js` (default port 3000; `PORT` can override it).
- `npm test` — currently a placeholder that exits with “Error: no test specified”; no test suite is configured.

## Change rules

- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never touch `data/db.json`.
- Add no dependencies.
