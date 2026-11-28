# Repository Guidelines

## Stack

ShopLedger is a Node.js application using Express 4 and CommonJS JavaScript. The browser interface is plain HTML, CSS, and JavaScript. Runtime data is stored in a JSON file.

## Module Map

- `server.js` configures Express, serves `public/`, and mounts API routes.
- `routes/` implements product, order, customer, and report HTTP endpoints.
- `lib/` contains business logic: orders, inventory, pricing, coupons, tax, ledger, reports, dates, invoices, and JSON storage.
- `public/` contains the UI and its assets; `config.js` holds app, tax, inventory, and coupon settings.
- `data/db.json` is the application data file.

## Commands

- `npm start` starts the server (`PORT` can override the default port 3000).
- `npm test` is present but currently exits with “no test specified”; no test framework is configured.

## Change Rules

- Before changing behavior, write characterization tests that capture the existing behavior and the intended change.
- Change only the module the ticket is about. Keep unrelated modules and files untouched.
- Tests must never read, write, or otherwise touch `data/db.json`; use isolated test data or stubs.
- Do not add dependencies. Use the packages and runtime capabilities already available in the project.
