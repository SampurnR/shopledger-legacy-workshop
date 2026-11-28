# ShopLedger contributor notes

## Stack

- Node.js app using Express 4 and `body-parser` for JSON request bodies.
- Browser UI is plain HTML, CSS, and JavaScript in `public/`.
- App data is stored as JSON in `data/db.json` through `lib/store.js`.
- Runtime dependencies are declared in `package.json`: `express` and `body-parser`.

## Module map

- `server.js` creates the Express app, serves `public/`, mounts API routes, and serves printable invoices.
- `routes/` contains the products/coupons, orders, customers/settlements, and reports/pricing-preview endpoints.
- `lib/` contains order handling, inventory, pricing, tax, coupons, khata ledger, persistence, dates, invoices, and report calculations.
- `config.js` contains the port and shop, tax, inventory, and coupon configuration.
- `data/db.json` contains the persisted products, orders, customers, settlements, IDs, and audit log.
- `public/` contains the browser interface and its styles and client-side logic.

## Commands

- `npm start` starts the app with `node server.js` (default port is 3000; `PORT` can override it).
- `npm test` currently only prints “Error: no test specified” and exits with failure; there is no configured test suite.

## Change rules

- Before changing behaviour, write characterization tests that capture the current behaviour.
- Change only the module the ticket is about. Do not make unrelated edits.
- Tests must never read or write `data/db.json`; use isolated test data instead.
- Do not add dependencies.
