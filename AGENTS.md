# ShopLedger

## Stack

- Node.js with CommonJS modules.
- Express 4 and `body-parser` provide the HTTP server and JSON request parsing.
- The UI is plain HTML, CSS, and browser JavaScript in `public/`.
- Application data is stored in `data/db.json` through synchronous filesystem reads and writes in `lib/store.js`.
- No test suite is currently configured. The `npm test` script is a placeholder that exits with an error.

## Module map

- `server.js`: Express app, static files, route registration, and printable invoice endpoint.
- `routes/`: API handlers for products and coupons, orders, customers and settlements, and reports/pricing preview/export.
- `lib/`: order, inventory, pricing, tax, coupon, ledger, report, invoice, date, and JSON store logic.
- `config.js`: server port, shop details, GST slabs, inventory setting, and coupon definitions.
- `public/`: browser UI (`index.html`), UI behavior/API calls (`js/app.js`), and styles (`css/style.css`).
- `data/db.json`: checked-in products, orders, customers, settlements, and audit log.

## Commands

- `npm start` — starts the server with `node server.js` (default port 3000; override with `PORT`).
- `npm test` — currently prints “Error: no test specified” and exits nonzero; there is no configured test suite.

## Change rules

- Before changing behavior, write characterization tests that capture the existing behavior.
- Change only the module the ticket is about.
- Tests must never read from or write to `data/db.json`; use isolated test data instead.
- Do not add dependencies.
