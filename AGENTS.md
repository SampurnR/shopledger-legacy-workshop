# Repository Guidelines

## Stack

ShopLedger is a Node.js application using Express 4 and CommonJS modules. The browser interface is served as static files from `public/`. Application data is stored in `data/db.json` through `lib/store.js`.

## Module Map

- `server.js` configures Express and mounts routes.
- `routes/` contains API route modules for products, orders, customers, and reports.
- `lib/` contains business modules for storage, orders, pricing, tax, inventory, ledger, invoices, dates, coupons, and reports.
- `public/` contains the HTML, CSS, and browser JavaScript.
- `config.js` contains application configuration.
- `data/db.json` contains the local application data.

## Commands

- `npm start` starts the server with Node (`PORT` defaults to `3000`).
- `npm test` is currently a placeholder that exits with an error; no test suite is configured.

## Change Rules

- Write characterization tests before changing behavior.
- Change only the module the ticket is about.
- Tests must never read from or write to `data/db.json`; use isolated test data.
- Do not add dependencies.
