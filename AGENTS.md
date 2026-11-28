# Repository guidance

## Stack

- Node.js, using CommonJS modules.
- Express 4 and body-parser provide the HTTP server and JSON request parsing.
- The UI is static HTML, CSS, and browser JavaScript served from `public/`.
- Application data is stored in `data/db.json` through synchronous file reads and writes in `lib/store.js`.

## Module map

- `server.js` starts Express, serves `public/`, mounts the API routers, and serves printable order invoices.
- `routes/` contains the products, orders, customers, and reports API handlers.
- `lib/` contains order and pricing rules, coupon and tax calculations, inventory and Khata ledger logic, invoice rendering, reports, date utilities, and JSON storage.
- `config.js` holds the port, shop details, tax settings, inventory settings, and coupons.
- `public/` contains the browser UI; `data/db.json` contains products, orders, customers, settlements, and audit entries.

## Commands

- `npm start` runs `node server.js`.
- `npm test` is currently a placeholder that exits with an error; no test suite is configured.

## Change rules

- Before changing behaviour, write characterization tests for the existing behaviour.
- Change only the module the ticket is about.
- Tests must never read from or write to `data/db.json`; use isolated test data instead.
- Do not add dependencies.
