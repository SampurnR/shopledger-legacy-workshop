# Repository Guidelines

## Project Structure & Module Organization

This repository is a small Express application with a browser based point of sale. `server.js` mounts the API and serves `public/` (`index.html`, `js/app.js`, and `css/style.css`). HTTP handlers live in `routes/`; business logic for orders, inventory, pricing, coupons, tax, customers, reports, dates, invoices, and persistence lives in `lib/`. `config.js` holds shop and business settings. `data/db.json` is the application’s JSON data store. `docs/architecture.svg` diagrams the main modules and order flow. There is currently no test directory.

## Build, Test, and Development Commands

- `npm start` — run the app locally at `http://localhost:3000` (or the configured `PORT`).
- `npm test` — currently a placeholder that exits with an error; no test framework or build step is configured.

Install dependencies with `npm install` when setting up a development environment. The app reads and writes `data/db.json`, so use a backup or isolated copy when exercising changes that persist data.

## Coding Style & Naming Conventions

Follow the existing CommonJS and JavaScript style: two space indentation, single quoted strings, semicolons, and `var` declarations. Use lower camel case for functions and variables, and descriptive lower-case filenames such as `pricing.js`. Keep HTTP parsing and response handling in `routes/`; place reusable business rules in `lib/`. No formatter or linter is configured, so match surrounding code and keep modules focused.

## Testing Guidelines

No automated tests or coverage requirements are present. Do not treat the current `npm test` script as a passing test suite. For behavior changes, describe the checks performed; when practical, manually verify the affected UI or API path using a separate data copy. Add automated tests only alongside an explicitly configured framework and a useful test command.

## Commit & Pull Request Guidelines

Recent commits use short, lower-case summaries describing the change (for example, `support hsn gst slabs and coupon maxDiscount caps`). Follow that pattern and keep each commit focused. A pull request should explain the user-visible or data-flow change, list validation performed, link related work when applicable, and include screenshots for UI changes. Call out changes to persisted data shapes or configuration so reviewers can assess compatibility.

## Security & Configuration Tips

Do not commit real customer data, secrets, or deployment credentials. Review `config.js` before exposing the app beyond a trusted local environment; it contains a hard-coded admin key and business settings. Treat `data/db.json` as persistent customer and transaction data.
