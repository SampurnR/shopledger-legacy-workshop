# Repository Guidelines

## Project Structure & Module Organization

ShopLedger is an Express and browser JavaScript app. `server.js` configures Express, serves `public/`, mounts API routers, and serves printable invoices. `routes/` contains `orders.js`, `products.js`, `customers.js`, and `reports.js`. `lib/` contains `orders.js`, `inventory.js`, `pricing.js`, `tax.js`, `coupons.js`, `ledger.js`, `reports.js`, `invoice.js`, `dates.js`, and `store.js`. `config.js` holds shop, tax, coupon, and inventory settings; `data/db.json` is the JSON data store. `public/` contains the UI assets; `docs/` contains documentation. No test directory currently exists.

## Build, Test, and Development Commands

- `npm start` runs `node server.js`; the app listens on port 3000 unless `PORT` is set.
- `npm test` is a placeholder that exits with an error; no test framework, build, formatter, or linter is configured.

## Coding Style & Change Scope

Follow the existing CommonJS and ES5-style JavaScript: `var`, `require`, callback-based Express handlers, two-space indentation, semicolons, and single-quoted strings. Use lowercase, descriptive module filenames. Keep HTTP handling in `routes/` and reusable business rules in `lib/`.

- Change only the module the ticket is about. Avoid unrelated cleanup or edits to neighboring modules.
- Do not add any new dependencies.

## Testing Guidelines

- Write characterization tests before changing behaviour, capturing what the current code does.
- Tests must never read from or write to `data/db.json`; use in-memory test data.
- There is no test runner configured today. Do not represent `npm test` as a passing suite; it currently reports that no test is specified.

## Commit & Pull Request Guidelines

Recent commit subjects are short, lowercase summaries (for example, `invoice page for accountant`). Keep commits focused and use a concise summary. Pull requests should describe the change and verification performed, call out data or configuration impacts, and include screenshots for visible UI changes. Link related issues when available.

## Security & Data Handling

The app stores orders, customers, settlements, and audit entries in `data/db.json`; do not use real customer data in tests. `config.js` contains an admin export key. Treat it as sensitive and do not expose it in logs or public deployments. Consider effects on stored data and printable invoices when working on order, inventory, tax, coupon, or Khata logic.
