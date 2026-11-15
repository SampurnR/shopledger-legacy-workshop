# Repository guidance

## Stack

- Node.js application with Express 4 and `body-parser`.
- Browser UI uses plain HTML, CSS, and JavaScript under `public/`.
- Persistent application data is stored in `data/db.json` through `lib/store.js`.
- No test framework or test suite is currently configured.

## Module map

- `server.js`: creates the Express app, serves `public/`, mounts routes, and serves printable invoice HTML.
- `config.js`: port, shop details, tax slabs, inventory settings, and coupon definitions.
- `routes/`: HTTP endpoints for orders, products/coupons, customers/settlements, and reports.
- `lib/`: order, inventory, pricing, coupon, tax, ledger, date, report, invoice, and JSON store logic.
- `public/`: browser app markup, behavior, and styling.
- `data/db.json`: current products, orders, customers, settlements, audit entries, and ID counters.

## Commands

- `npm start` runs `node server.js` and starts the app.
- `npm test` currently runs a placeholder that prints `Error: no test specified` and exits with status 1; there is no configured test suite.

## Change rules

- Write characterization tests before changing behavior.
- Change only the module the ticket is about.
- Tests must never read from or write to `data/db.json`; use isolated test data instead.
- Do not add dependencies.
