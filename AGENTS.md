# ShopLedger

## Stack

Node.js with CommonJS, Express 4, and `body-parser`. The browser UI uses plain HTML, CSS, and JavaScript. Persistence uses a JSON file.

## Module map

- `server.js` serves the UI, mounts the API routers, and handles printable invoices.
- `routes/` contains the product, order, customer, and report routers.
- `lib/` contains order, pricing, coupon, GST, inventory, invoice, reporting, and customer ledger logic. `lib/store.js` reads and writes `data/db.json`.
- `config.js` holds application settings. `public/` contains the browser UI.

## Command

Run `npm start` from this directory to start the app at `http://localhost:3000` by default. The `npm test` script is a placeholder that exits with status 1.

## Rules

- Write characterization tests before changing behavior.
- Change only the module the ticket is about.
- Tests must never read or write `data/db.json`.
- Add no dependencies.
