# Repository Guidelines

## Stack

ShopLedger is a CommonJS Node.js application using Express 4 and body-parser. The browser UI is plain HTML, CSS, and JavaScript. Application records are stored in `data/db.json`.

## Module Map

- `server.js` creates the Express app, serves `public/`, and mounts API routers.
- `routes/` contains product, order, customer, and report endpoints.
- `lib/` contains business logic: orders, inventory, pricing, tax, coupons, customer ledger, reports, invoices, dates, and JSON persistence.
- `config.js` holds port, shop, tax, inventory, and coupon settings.
- `public/` contains the UI and its assets; `data/db.json` is the persistent data file.

## Commands

- `npm start` runs `node server.js` on port 3000 by default; `PORT` can override it.
- `npm test` is currently a placeholder that exits with “no test specified.” No build command is configured.

## Change Rules

- Before changing behavior, write characterization tests that capture the current behavior.
- Change only the module the ticket is about. Keep unrelated modules untouched.
- Tests must never read or write `data/db.json`; use isolated test data instead.
- Add no dependencies. Use the packages already declared in `package.json`.
