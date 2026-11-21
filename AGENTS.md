# Repository guide

## Stack

- Node.js with CommonJS JavaScript.
- Express 4 serves the static browser app and JSON API; the UI is plain HTML, CSS, and JavaScript.
- Persistence is a local JSON file at `data/db.json`, accessed through `lib/store.js`.
- Runtime dependencies declared in `package.json`: `express` and `body-parser`.

## Module map

- `server.js` creates the Express app, serves `public/`, mounts the API routers, and serves the invoice page.
- `public/` contains the browser interface and its styles and client code.
- `routes/` contains the product, order, customer, and report API routers.
- `lib/` contains order, inventory, pricing, coupon, tax, Khata ledger, date, invoice, report, and JSON-store logic.
- `config.js` contains port, shop, tax, inventory, and coupon settings.
- `data/db.json` contains the local products, customers, orders, settlements, and audit log.

## Commands

- `npm start` starts the server with `node server.js` (default port 3000; `PORT` can override it).
- `npm test` currently exits with `Error: no test specified`; no test suite is configured in `package.json`.

## Working rules

- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never touch `data/db.json`.
- Add no dependencies.
