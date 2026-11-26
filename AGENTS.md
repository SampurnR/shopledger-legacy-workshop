# Repository Guidelines

## Project Structure & Module Organization

ShopLedger is a small Express application with a browser-based POS interface.

- `server.js` composes the app, serves `public/`, mounts API routers, and exposes the invoice page.
- `routes/` contains HTTP handlers: `products.js`, `orders.js`, `customers.js`, and `reports.js`.
- `lib/` contains domain logic. Keep inventory, pricing, tax, coupon, order, ledger, invoice, report, date, and JSON-store concerns in their existing modules.
- `public/` contains `index.html`, `js/app.js`, and `css/style.css`.
- `data/db.json` is the application's persisted data. Treat it as production-like fixture data; do not casually reformat or reset it.
- `docs/` holds repository documentation and diagrams.

## Build, Test, and Development Commands

- `npm install` installs the declared Express dependencies.
- `npm start` runs `node server.js` on `PORT` or port `3000`.
- `npm test` currently exits with an error because no automated test suite is configured. Do not present it as a passing verification step.

There is no build, formatter, linter, or test framework configured. Avoid adding tooling unless the task requires it.

## Coding Style & Naming Conventions

Use the repository's existing CommonJS and ES5-style JavaScript: `var`, `require`, `module.exports`, function expressions, semicolons, and two-space indentation. Name route files by resource (`orders.js`) and library modules by responsibility (`pricing.js`). Keep API paths under `/api`; preserve the existing response style (`{ error: '...' }` on failure).

Keep pricing, tax, inventory, and Khata changes server-authoritative. Product prices and HSN data should be resolved from the database, not trusted from browser input.

## Testing Guidelines

No tests currently exist. For logic changes, add focused tests before claiming automated coverage, especially for tax rounding, coupons, inventory release, order cancellation, and credit-limit calculations. Until a test runner is introduced, document manual API/UI checks in the pull request.

## Commit & Pull Request Guidelines

Follow the existing concise, imperative, lower-case subject style, for example: `support hsn gst slabs and coupon maxDiscount caps`. Keep commits narrowly scoped. Pull requests should describe behavior changes, data migrations to `data/db.json`, verification performed, and screenshots for UI changes. Call out changes affecting totals, stock, invoices, or customer balances.

## Security & Configuration

Do not commit real credentials. `config.js` currently contains operational configuration and an admin key; prefer environment-backed secrets for any new sensitive values. Validate all request input on the server and preserve audit-log updates for financial mutations.
