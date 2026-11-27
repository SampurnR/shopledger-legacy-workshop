# Repository guidance

## Stack

- Node.js with CommonJS modules.
- Express 4 serves the browser app and JSON API; `body-parser` parses JSON requests.
- The UI is plain HTML, CSS, and browser JavaScript in `public/`.
- Application data is stored in `data/db.json`.
- Tests use the built-in `node:test` runner (no test dependencies). They live in `test/`.

## Module map

- `server.js`: Express app setup, static files, route mounting, and printable invoice endpoint.
- `config.js`: port, shop details, GST settings, inventory defaults, coupons, and admin export key.
- `routes/`: `products.js` serves products and coupons; `orders.js` handles orders; `customers.js` handles customers and settlements; `reports.js` serves reports, pricing preview, and export.
- `lib/`: `orders.js` order operations; `inventory.js` stock; `pricing.js`, `tax.js`, and `coupons.js` calculations; `ledger.js` Khata balances and settlements; `invoice.js` printable invoices; `reports.js` summaries and reconciliation; `dates.js` date helpers; `store.js` JSON file persistence and audit log.
- `public/`: browser UI (`index.html`, `js/app.js`, `css/style.css`).
- `data/db.json`: current local products, orders, customers, settlements, and audit data.

## Commands

Run from the repository root (`workshop/`):

- `npm start` — starts the app with `node server.js`.
- `node --test` — runs the tests in `test/` (currently `test/invoice.test.js`).
- `npm test` — still a placeholder that prints “Error: no test specified” and exits unsuccessfully; use `node --test` instead.

## Working rules

1. Write characterization tests before changing behaviour.
2. Change only the module the ticket is about.
3. Tests must never read or write `data/db.json`; use isolated test data instead.
4. Add no dependencies.
