# Repository guide

## Stack

- Node.js using CommonJS modules.
- Express 4 serves the API and the static frontend; `body-parser` handles JSON request bodies.
- The frontend is plain HTML, CSS, and browser JavaScript in `public/`.
- Application data is stored in `data/db.json` and read/written by `lib/store.js`.
- There is no test framework configured. The current `npm test` script is a placeholder that exits with an error.

## Module map

- `server.js`, `config.js`: Express app setup, route mounting, invoice page, and shop/tax/inventory configuration.
- `routes/`: HTTP endpoints for products and coupons, orders, customers and settlements, reports, pricing preview, and export.
- `lib/`: business logic for persistence (`store`), orders, inventory, pricing, tax, coupons, customer ledger, reports, dates, and invoice HTML.
- `public/`: single-page shop interface, its styles, and client-side application code.
- `data/db.json`: local JSON data store.

## Commands

- `npm install` installs the dependencies declared in `package.json`.
- `npm start` runs `node server.js` and serves the app on port 3000 by default; `PORT` overrides the port.
- `npm test` currently fails with “Error: no test specified”; there is no configured test suite yet.

## Working rules

- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never touch `data/db.json`.
- Add no dependencies.
