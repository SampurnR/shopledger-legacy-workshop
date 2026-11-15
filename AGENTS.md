# ShopLedger

## Stack

- Node.js CommonJS application using Express 4 and body-parser for JSON request bodies.
- Static browser UI in `public/` (HTML, CSS, and browser JavaScript).
- JSON file persistence through `lib/store.js` to `data/db.json`; there is no database server or ORM.
- No test framework or test files are currently configured.

## Module map

- `server.js`: Express app setup, static hosting, route mounting, and printable invoice endpoint.
- `routes/`: HTTP endpoints for products/coupons, orders, customers/settlements, reports, pricing preview, and admin export.
- `lib/`: business logic for orders, inventory, pricing, tax, coupons, customer ledger, reports, invoices, dates, and JSON file storage.
- `config.js`: server port and shop, tax, inventory, and coupon settings.
- `public/`: single page browser interface and its styles/scripts.
- `data/db.json`: application data read and written by `lib/store.js`.
- `docs/architecture.svg`: architecture diagram.

## Commands

- `npm start` — runs `node server.js` (listens on port 3000 unless `PORT` is set).
- `npm test` — currently a placeholder that prints “Error: no test specified” and exits unsuccessfully.

## Working rules

- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never touch `data/db.json`.
- Add no dependencies.
