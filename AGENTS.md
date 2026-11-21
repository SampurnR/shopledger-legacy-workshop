# Repository guide

## Stack

- Node.js with CommonJS JavaScript.
- Express 4 and `body-parser` provide the HTTP server and JSON request parsing.
- The UI is plain HTML, CSS, and browser JavaScript in `public/`.
- Application data is stored in `data/db.json` through `lib/store.js`.

## Module map

- `server.js` wires the Express app, serves `public/`, mounts the API routers, and renders the invoice route.
- `routes/` contains the products, orders, customers, and reports API routers.
- `lib/` contains order, inventory, pricing, coupon, tax, ledger, report, invoice, date, and JSON-store logic.
- `config.js` contains shop, tax, inventory, and coupon settings.
- `data/db.json` contains the current application data.
- `public/` contains the browser interface and its styles and scripts.

## Commands

- `npm start` runs `node server.js`.
- `npm test` is currently a placeholder that prints `Error: no test specified` and exits with status 1. There is no configured test suite.

## Rules for changes

- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never read or write `data/db.json`.
- Add no dependencies.
