# ShopLedger

## Stack

- Node.js with CommonJS modules.
- Express 4 serves the API and static files; `body-parser` parses JSON request bodies.
- The browser UI is plain HTML, CSS, and JavaScript in `public/`.
- Application data is stored in `data/db.json` through `lib/store.js`.
- Runtime dependencies are `express` and `body-parser`.

## Module map

- `server.js`, `config.js`: app setup, route mounting, configuration, and invoice page.
- `routes/`: product and coupon reads, order operations, customer settlements, reports, pricing preview, and admin export endpoints.
- `lib/`: data store and business logic for orders, inventory, pricing, coupons, tax, ledger, invoices, reports, and dates.
- `public/`: browser app, styles, and HTML entry point.
- `data/db.json`: local JSON data read and written by the store.
- `docs/`: architecture diagram.

## Commands

- `npm start` — starts the server on `PORT` or port 3000.
- `npm test` — runs the test suite with `node --test`.

## Change rules

- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never touch `data/db.json`.
- Add no dependencies.
