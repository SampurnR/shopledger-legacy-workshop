# ShopLedger

## Stack

- Node.js, CommonJS JavaScript, and Express 4.
- Browser UI uses plain HTML, CSS, and JavaScript.
- Application data is stored in `data/db.json` through `lib/store.js`.
- There is no test framework or implemented test suite in the repository.

## Module map

- `server.js`: Express setup, static files, route mounting, and printable invoice route.
- `config.js`: port, shop details, tax slabs, inventory defaults, coupons, and admin key.
- `routes/`: API handlers for products/coupons, orders, customers/settlements, and reports/pricing/admin export.
- `lib/`: business logic for coupons, dates, inventory, invoices, customer ledger, orders, pricing, reports, tax, and JSON storage.
- `public/`: browser UI (`index.html`, `js/app.js`, `css/style.css`).
- `data/db.json`: current local products, orders, customers, settlements, and audit log.

## Commands

- `npm start` — runs `node server.js` (listens on port 3000 unless `PORT` is set).
- `npm test` — currently prints “Error: no test specified” and exits with an error; no test suite is configured.

## Change rules

- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never touch `data/db.json`.
- Add no dependencies.
