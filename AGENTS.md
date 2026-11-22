# Repository Guidelines

## Stack

ShopLedger uses Node.js and Express with CommonJS modules. The browser interface is plain HTML, CSS, and JavaScript. Application records are stored in `data/db.json`.

## Module Map

- `server.js` initializes Express and mounts routes.
- `routes/` contains API handlers for products, orders, customers, and reports.
- `lib/` contains business logic for inventory, orders, pricing, tax, invoices, reports, and ledger operations.
- `public/` contains the UI; `config.js` contains app configuration.

## Commands

- `npm start` runs the app on port 3000, or the port set by `PORT`.
- `npm test` is currently a placeholder that exits with an error; no test framework is configured.

## Contribution Rules

- Before changing behavior, write characterization tests that capture the existing behavior.
- Change only the module the ticket is about.
- Tests must never read or write `data/db.json`.
- Do not add dependencies.
