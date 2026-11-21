# Repository Guidelines

## Project Structure & Module Organization

- `server.js` starts the Express application and mounts the API routers in `routes/`.
- `lib/` contains order, pricing, tax, coupon, inventory, ledger, persistence, date, invoice, and report logic.
- `public/` contains the browser interface (`index.html`, `js/`, and `css/`).
- `config.js` holds shop and business settings. `data/db.json` is the app's persistent data file.
- `docs/` contains project documentation. There is no test directory in the repository.

## Build, Test, and Development Commands

- `npm start` runs the app with `node server.js` (default port 3000; `PORT` can override it).
- `npm test` is currently a placeholder that prints “no test specified” and exits with an error. No build, lint, or formatting scripts are configured.
- Install dependencies with `npm install` when setting up a development environment.

## Coding Style & Naming Conventions

Follow the existing CommonJS JavaScript style: two-space indentation, single-quoted strings, semicolons, and `var` declarations. Name route and library files in lowercase (`routes/orders.js`, `lib/pricing.js`); use descriptive camelCase for functions and variables. Keep HTTP handling in `routes/` and reusable business rules in `lib/`.

## Testing Guidelines

No test framework or automated tests are present. For changes, describe the relevant manual checks in the pull request. For calculation or persistence changes, cover representative normal and boundary cases; do not treat the current `npm test` placeholder as a passing test suite.

For behavior changes, write characterization tests before changing behavior. Change only the module the ticket is about. Tests must never read from or write to `data/db.json`. Do not add dependencies.

## Commit & Pull Request Guidelines

Recent commits use short, lowercase, descriptive summaries (for example, `support hsn gst slabs and coupon maxDiscount caps`). Follow that pattern and state the behavior changed. Pull requests should explain the user-visible effect, list validation performed, link related issues when available, and include screenshots for browser UI changes.

## Security & Data

`data/db.json` contains operational records, including customer and account information. Avoid committing real customer data or secrets. Configuration includes an admin key; do not copy credentials into documentation, logs, or examples.
