# Repository Guidelines

## Stack

ShopLedger is a CommonJS Node.js application using Express and body-parser. Its browser UI is plain HTML, CSS, and JavaScript. Application data is stored in `data/db.json`.

## Module Map

- `server.js` creates the Express app, serves `public/`, mounts the API routers, and serves invoice pages.
- `routes/` contains the product, order, customer, and report endpoints.
- `lib/` contains order and inventory logic, pricing and coupons, tax, customer ledger, reports, invoices, date helpers, and JSON-file storage.
- `config.js` holds shop, tax, coupon, and inventory settings.
- `public/` contains the browser UI; `data/db.json` contains products, customers, orders, settlements, and audit entries.

## Commands

- `npm start` starts the server (`PORT` overrides the default port 3000).
- `npm test` is currently a placeholder that exits with “no test specified”; no test framework is configured.

## Change Rules

- Write characterization tests before changing behaviour.
- Change only the module the ticket is about.
- Tests must never read or write `data/db.json`; use isolated test data.
- Add no dependencies.
