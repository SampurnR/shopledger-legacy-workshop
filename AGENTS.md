# Repository Guidelines

## Project Structure & Module Organization

ShopLedger is a small Express application. `server.js` wires the app and routes; `routes/` contains API endpoints; `lib/` holds business logic for orders, pricing, tax, inventory, coupons, ledgers, reports, and JSON persistence. The browser interface lives in `public/` (`index.html`, `css/`, and `js/`). `data/db.json` is the local file-backed store, and `docs/architecture.svg` documents the design. There is no separate test directory currently.

## Build, Test, and Development Commands

- `npm install` installs the declared Express dependencies.
- `npm start` starts the server on port 3000; set `PORT` to override it.
- `npm test` currently exits with “no test specified”; do not treat it as a passing test suite.

There is no build or lint script configured. For local checks, start the server and exercise the relevant UI or `/api` endpoints with sample data.

## Coding Style & Naming Conventions

Follow the existing CommonJS JavaScript style: two-space indentation, single-quoted strings, semicolons, and `var` declarations. Use lower camel case for functions and variables, and short plural filenames for route modules (for example, `routes/orders.js`). Keep HTTP request/response handling in `routes/` and reusable domain rules in `lib/`. Avoid adding formatting or linting conventions that conflict with neighboring files.

## Testing Guidelines

No test framework, test files, or coverage requirement is configured. If adding tests, introduce a repeatable runner and document its command; cover business rules such as tax, coupon limits, stock reservations, and order cancellation. Do not change `data/db.json` unintentionally while manually exercising write endpoints; restore fixture changes before committing.

## Commit & Pull Request Guidelines

Recent history uses concise, lowercase, descriptive commit subjects (for example, “customer khata credit ledger and order cancellation”). Match that style and focus each commit on one change. Pull requests should explain behavior changes, list manual or automated checks performed, link related issues when available, and include screenshots for visible UI changes.

## Security & Configuration Tips

The app persists operational data in `data/db.json`. Keep real customer and sales data out of commits. Review `config.js` before deployment: it contains an admin key and shop details that should be moved to environment-specific configuration before exposing the app beyond a trusted local environment.
