# Repository Guidelines

## Rules

1. Write characterization tests before changing behavior.
2. Change only the module the ticket is about.
3. Tests must never read from or write to `data/db.json`. Use in-memory fixtures or stub filesystem access.
4. Add no dependencies.

## Stack

ShopLedger is an internal point-of-sale app for billing, inventory, GST invoices, and Khata customer credit. It runs on CommonJS Node.js. `package.json` declares Express `^4.17.1` and `body-parser` `^1.19.0`. The browser uses plain HTML, CSS, and JavaScript, and the app stores data in a local JSON file.

## Project Structure and Module Organization

- `server.js` serves `public/index.html`, `public/js/app.js`, and `public/css/style.css`. It mounts the product, order, customer, and report routers in `routes/` under `/api` and defines `GET /orders/:id/invoice`.
- `lib/` holds business logic. Start in `pricing.js`, `tax.js`, or `coupons.js` for checkout totals, `invoice.js` for printed figures, and `inventory.js` or `ledger.js` for stock and credit.
- `config.js` defines the port, shop details, GST rates, inventory settings, and coupons. `lib/store.js` reads and rewrites the tracked `data/db.json`.

`POST /api/orders` checks stock, calculates totals, applies Khata credit when selected, deducts stock, and saves the order and audit entry before returning `201`. See the [architecture diagram](docs/architecture.png) for the full path.

## Build, Test, and Development Commands

- `npm install` installs the dependencies declared in `package.json`.
- `npm start` runs `node server.js`. Open `http://localhost:3000`, or set `PORT` to use another port.
- `npm test` is a placeholder that exits with `Error: no test specified`.
- `node --check routes/orders.js` checks syntax without starting the app.

The server serves browser assets directly. The repository has no build, lint, or format script.

## Coding Style and Naming Conventions

Match nearby code. Use two-space indentation, single quotes, semicolons, camelCase identifiers such as `computeTotals`, and lowercase filenames. Follow the existing `var` declarations and CommonJS exports. Keep HTTP handling in `routes/` and reusable business rules in `lib/`.

## Testing and Data

There is no configured test suite, test directory, naming convention, or coverage threshold. Use Node.js's built-in `assert` to capture current behavior. For stock or credit changes, cover the relevant success and rejection cases and assert the resulting fixture balances or quantities. For GST changes, capture checkout totals and invoice figures separately because they use different calculation paths.

Stub storage or filesystem calls before testing persistence. Keep manual checks to paths that never write to `data/db.json`.

## Commit and Pull Request Guidelines

Use short, lowercase commit subjects like `invoice page for accountant`. In pull requests, name the module, explain the change, list checks run, link related issues when available, and include screenshots for visual changes.
