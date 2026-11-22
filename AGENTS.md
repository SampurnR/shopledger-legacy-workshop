# Repository Guidelines

## Project Structure & Module Organization

This repository is a small Node.js/Express POS application. `server.js` wires the app and serves the invoice page; `routes/` contains the products, orders, customers, and reports routers; `lib/` holds pricing, GST, inventory, ledger, persistence, invoice, and reporting logic. Browser assets are in `public/` (`index.html`, `js/`, and `css/`). `config.js` stores shop and business rules, while `data/db.json` is the application data store. `docs/` contains architecture documentation. There is no dedicated test directory.

## Build, Test, and Development Commands

- `npm start` runs the local server with `node server.js` (default port 3000; set `PORT` to override it).
- There is no build or lint script configured.
- `npm test` is a placeholder that exits with “no test specified”; no automated test suite is configured. Do not treat it as a passing verification command.

## Coding Style & Naming Conventions

Follow the existing CommonJS style (`require`/`module.exports`) and two-space indentation. Keep route handlers in the relevant `routes/*.js` file and reusable business logic in `lib/*.js`. Use descriptive camelCase function and variable names; use lowercase, plural filenames for route modules (for example, `routes/orders.js`). Keep calculations in shared library modules rather than duplicating them in routes or invoice rendering. Preserve existing JSON field names when changing persisted records.

## Testing Guidelines

Before submitting behavior changes, manually review the affected route and library paths. Add focused automated tests if introducing a test framework, and document the chosen command; currently the repository has no test framework or coverage target. Do not claim `npm test` validates changes until its placeholder is replaced.

## Commit & Pull Request Guidelines

Recent history uses short, lowercase, descriptive commit subjects (for example, `invoice page for accountant` and `support hsn gst slabs and coupon maxDiscount caps`). Follow that style unless the team specifies a convention. Pull requests should explain the behavior change, list affected routes/data fields, describe verification performed, and include screenshots for visible UI changes. Call out any changes to GST, discounts, Khata balances, or inventory semantics clearly.

## Security & Data Handling

`data/db.json` contains operational records and is rewritten by the app. Back it up before manual edits and avoid committing temporary or sensitive data. Keep credentials out of source control; review `config.js` before exposing admin endpoints or deploying beyond a trusted local environment.
